"""Mocked provider-chain tests. These prove control flow only, not live provider availability."""

import io
import json
from urllib.error import HTTPError, URLError

import pytest

import color_providers
import config
from color_providers import ProviderError


VALID = {
    "isFace": True, "description": "", "detectedGender": "female", "seasonType": "Soft Autumn", "seasonDescription": "Muted and warm.",
    "undertone": "Warm", "undertoneDescription": "Golden.", "skinAge": 30, "skinAgeDescription": "Estimate.",
    "colorsToWear": [{"name": f"Wear {i}", "hex": "#12345A"} for i in range(6)],
    "colorsToAvoid": [{"name": f"Avoid {i}", "hex": "#654321"} for i in range(3)],
}
IMAGE = "a" * 200


def gemini_body(payload):
    return {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": json.dumps(payload) if not isinstance(payload, str) else payload}]}}]}


def openai_body(payload):
    return {"output_text": json.dumps(payload) if not isinstance(payload, str) else payload}


def http_error(status, body=None, headers=None):
    return HTTPError("https://example.invalid", status, "error", headers or {}, io.BytesIO(json.dumps(body or {}).encode()))


class FakeTransport:
    """Routes urlopen calls by URL fragment; each route holds a queue of responses or exceptions."""

    def __init__(self, gemini_models, openai_models):
        self.routes = {
            "models?pageSize": [{"models": [{"name": f"models/{name}", "supportedGenerationMethods": ["generateContent"]} for name in gemini_models]}] * 5,
            "/v1/models": [{"data": [{"id": name} for name in openai_models]}] * 5,
        }
        self.calls = []

    def __call__(self, request, timeout=None):
        url = request.full_url
        self.calls.append({"url": url, "timeout": timeout, "headers": dict(request.header_items())})
        for fragment, queue in self.routes.items():
            if fragment in url:
                if not queue:
                    raise AssertionError(f"No response left for {url}")
                response = queue.pop(0)
                if isinstance(response, BaseException):
                    raise response
                return io.BytesIO(json.dumps(response).encode())
        raise AssertionError(f"Unexpected URL {url}")

    def count(self, fragment):
        return sum(fragment in call["url"] for call in self.calls)


GEN_PRIMARY = "gemini-primary:generateContent"
GEN_SECONDARY = "gemini-secondary:generateContent"


def routes(primary=None, secondary=None, openai=None):
    return {key: value for key, value in {"models/" + GEN_PRIMARY: primary, "models/" + GEN_SECONDARY: secondary, "/v1/responses": openai}.items() if value is not None}


def install_routes(monkeypatch, gemini_models=("gemini-primary", "gemini-secondary"), openai_models=("gpt-vision",), **kwargs):
    fake = FakeTransport(gemini_models=gemini_models, openai_models=openai_models)
    fake.routes.update(routes(**kwargs))
    monkeypatch.setattr(color_providers, "urlopen", fake)
    return fake


def test_gemini_success_uses_primary_once_and_sends_key_in_header(monkeypatch):
    fake = install_routes(monkeypatch, primary=[gemini_body(VALID)])
    result, provider, model, attempts = color_providers.analyze_color(IMAGE, "image/jpeg")
    assert (provider, model, result["seasonType"]) == ("gemini", "gemini-primary", "Soft Autumn")
    assert fake.count(GEN_PRIMARY) == 1 and fake.count("/v1/responses") == 0
    assert all("key=" not in call["url"] for call in fake.calls)
    assert fake.calls[-1]["headers"].get("X-goog-api-key") == "gemini-test-key"
    assert attempts == [{"provider": "gemini", "model": "gemini-primary", "outcome": "success", "ms": attempts[0]["ms"]}]


def test_gemini_503_fails_over_to_next_gemini_model(monkeypatch):
    fake = install_routes(monkeypatch, primary=[http_error(503)], secondary=[gemini_body(VALID)])
    _, provider, model, attempts = color_providers.analyze_color(IMAGE, "image/jpeg")
    assert (provider, model) == ("gemini", "gemini-secondary")
    assert [a["outcome"] for a in attempts] == ["temporary", "success"]
    assert fake.count(GEN_PRIMARY) == 1


def test_gemini_503_everywhere_falls_back_to_openai(monkeypatch):
    install_routes(monkeypatch, primary=[http_error(503)], secondary=[http_error(503)], openai=[openai_body(VALID)])
    result, provider, model, _ = color_providers.analyze_color(IMAGE, "image/jpeg")
    assert (provider, model, result["undertone"]) == ("openai", "gpt-vision", "Warm")


def test_gemini_rate_limit_then_openai_success_records_retry_delay(monkeypatch):
    limited = http_error(429, {"error": {"status": "RESOURCE_EXHAUSTED", "details": [{"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": "7s"}]}})
    monkeypatch.setattr(config, "GEMINI_FALLBACK_MODELS", ())
    install_routes(monkeypatch, primary=[limited], openai=[openai_body(VALID)])
    _, provider, _, attempts = color_providers.analyze_color(IMAGE, "image/jpeg")
    assert provider == "openai"
    assert attempts[0]["outcome"] == "rate_limit" and attempts[0]["retryAfter"] == 7


def test_gemini_daily_quota_is_quota_and_cooled_down(monkeypatch):
    exhausted = http_error(429, {"error": {"status": "RESOURCE_EXHAUSTED", "details": [{"violations": [{"quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier"}]}]}})
    fake = install_routes(monkeypatch, primary=[exhausted], secondary=[gemini_body(VALID), gemini_body(VALID)])
    _, _, model, attempts = color_providers.analyze_color(IMAGE, "image/jpeg")
    assert model == "gemini-secondary" and attempts[0]["outcome"] == "quota"
    _, _, model, attempts = color_providers.analyze_color(IMAGE, "image/jpeg")
    assert model == "gemini-secondary" and attempts[0].get("skipped") == "cooldown"
    assert fake.count(GEN_PRIMARY) == 1


def test_openai_401_is_credentials_and_nothing_is_fabricated(monkeypatch):
    install_routes(monkeypatch, primary=[http_error(503)], secondary=[http_error(503)])
    fake = color_providers.urlopen
    fake.routes["/v1/models"] = [http_error(401)]
    with pytest.raises(ProviderError) as raised:
        color_providers.analyze_color(IMAGE, "image/jpeg")
    assert raised.value.kind == "temporary"
    assert [a["outcome"] for a in raised.value.attempts] == ["temporary", "temporary", "credentials"]
    assert fake.count("/v1/responses") == 0


def test_openai_insufficient_quota_is_not_a_rate_limit_and_is_skipped_next_time(monkeypatch):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "")
    quota = http_error(429, {"error": {"type": "insufficient_quota", "code": "credit_balance_exhausted"}})
    fake = install_routes(monkeypatch, openai=[quota])
    with pytest.raises(ProviderError) as raised:
        color_providers.analyze_color(IMAGE, "image/jpeg")
    assert raised.value.kind == "unavailable"
    assert raised.value.attempts[-1]["outcome"] == "quota"
    with pytest.raises(ProviderError) as again:
        color_providers.analyze_color(IMAGE, "image/jpeg")
    assert again.value.attempts[-1].get("skipped") == "cooldown"
    assert fake.count("/v1/responses") == 1


def test_missing_credentials_make_no_network_calls(monkeypatch):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "")
    monkeypatch.setattr(config, "OPENAI_API_KEY", "")
    with pytest.raises(ProviderError) as raised:
        color_providers.analyze_color(IMAGE, "image/jpeg")
    assert raised.value.kind == "unavailable"
    assert {a["outcome"] for a in raised.value.attempts} == {"configuration"}


def test_unsupported_configured_model_is_skipped_without_inference(monkeypatch):
    fake = install_routes(monkeypatch, gemini_models=("gemini-secondary",), secondary=[gemini_body(VALID)])
    _, _, model, attempts = color_providers.analyze_color(IMAGE, "image/jpeg")
    assert model == "gemini-secondary" and attempts[0]["outcome"] == "model"
    assert fake.count(GEN_PRIMARY) == 0


def test_gemini_invalid_key_skips_remaining_gemini_models(monkeypatch):
    fake = install_routes(monkeypatch, openai=[openai_body(VALID)])
    fake.routes["models?pageSize"] = [http_error(403)]
    _, provider, _, attempts = color_providers.analyze_color(IMAGE, "image/jpeg")
    assert provider == "openai"
    assert [a["outcome"] for a in attempts] == ["credentials", "success"]


def test_timeouts_are_bounded_to_one_call_per_candidate(monkeypatch):
    fake = install_routes(monkeypatch, primary=[TimeoutError()], secondary=[URLError(TimeoutError("timed out"))], openai=[TimeoutError()])
    with pytest.raises(ProviderError) as raised:
        color_providers.analyze_color(IMAGE, "image/jpeg")
    assert raised.value.kind == "temporary"
    assert [a["outcome"] for a in raised.value.attempts] == ["timeout", "timeout", "timeout"]
    assert fake.count(GEN_PRIMARY) == fake.count(GEN_SECONDARY) == fake.count("/v1/responses") == 1


def test_attempt_timeout_never_exceeds_remaining_budget(monkeypatch):
    monkeypatch.setattr(config, "COLOR_ANALYSIS_MAX_SECONDS", 12)
    fake = install_routes(monkeypatch, primary=[gemini_body(VALID)])
    color_providers.analyze_color(IMAGE, "image/jpeg")
    generate = [call for call in fake.calls if GEN_PRIMARY in call["url"]][0]
    assert generate["timeout"] <= 12


def test_exhausted_budget_stops_the_chain(monkeypatch):
    monkeypatch.setattr(color_providers, "MIN_ATTEMPT_SECONDS", 10_000)
    install_routes(monkeypatch)
    with pytest.raises(ProviderError) as raised:
        color_providers.analyze_color(IMAGE, "image/jpeg")
    assert [a["outcome"] for a in raised.value.attempts] == ["budget"]


def test_malformed_responses_fail_over_and_are_reported(monkeypatch):
    incomplete = {**VALID, "colorsToWear": VALID["colorsToWear"][:2]}
    install_routes(monkeypatch, primary=[gemini_body("not json")], secondary=[gemini_body(incomplete)], openai=[openai_body(VALID)])
    _, provider, _, attempts = color_providers.analyze_color(IMAGE, "image/jpeg")
    assert provider == "openai" and [a["outcome"] for a in attempts] == ["malformed", "malformed", "success"]


def test_only_malformed_responses_raise_malformed(monkeypatch):
    install_routes(monkeypatch, primary=[gemini_body("{}")], secondary=[gemini_body("")], openai=[openai_body("[]")])
    with pytest.raises(ProviderError) as raised:
        color_providers.analyze_color(IMAGE, "image/jpeg")
    assert raised.value.kind == "malformed"


def test_not_a_face_is_a_valid_result_without_fallback(monkeypatch):
    fake = install_routes(monkeypatch, primary=[gemini_body({"isFace": False, "description": "Use daylight."})])
    result, _, _, _ = color_providers.analyze_color(IMAGE, "image/jpeg")
    assert result == {"isFace": False, "description": "Use daylight."}
    assert fake.count("/v1/responses") == 0


def test_normalization_accepts_minor_format_variants():
    loose = {**VALID, "undertone": "warm", "skinAge": "31", "colorsToWear": [{"name": " Rust ", "hex": "b7410e"}] * 6}
    result = color_providers.normalize_color_result(loose)
    assert (result["undertone"], result["skinAge"]) == ("Warm", 31)
    assert result["colorsToWear"][0] == {"name": "Rust", "hex": "#B7410E"}


def test_ai_guessed_gender_is_neither_required_nor_kept():
    # A provider may still volunteer a gender guess; it must not be needed or stored.
    with_guess = color_providers.normalize_color_result({**VALID, "detectedGender": "male"})
    without_guess = color_providers.normalize_color_result({key: value for key, value in VALID.items() if key != "detectedGender"})
    assert "detectedGender" not in with_guess and with_guess == without_guess
    assert "detectedGender" not in color_providers.OPENAI_COLOR_SCHEMA["properties"]


@pytest.mark.parametrize("change", [
    {"colorsToAvoid": [{"name": "Bad", "hex": "#12"}] * 3},
    {"skinAge": True},
    {"undertone": "Olive"},
    {"seasonType": ""},
    {"colorsToWear": [{"name": "", "hex": "#123456"}] * 6},
])
def test_normalization_rejects_invalid_results(change):
    with pytest.raises(ValueError):
        color_providers.normalize_color_result({**VALID, **change})


def test_grounded_search_quota_does_not_block_color_analysis():
    # Arrange: the search-grounding quota is exhausted for the primary model.
    color_providers._start_cooldown(ProviderError("quota", "quota", provider="gemini", model="gemini-primary"), scope="grounded")
    # Assert: grounded requests are paused, ordinary requests are not.
    assert color_providers._cooling_down("gemini", "gemini-primary", "grounded")[0] == "quota"
    assert color_providers._cooling_down("gemini", "gemini-primary") is None
    # Bad credentials still apply everywhere.
    color_providers._start_cooldown(ProviderError("bad key", "credentials", provider="gemini", model="gemini-primary"), scope="grounded")
    assert color_providers._cooling_down("gemini", "gemini-primary")[0] == "credentials"
