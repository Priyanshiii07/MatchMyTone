"""Free-tier quota hygiene: text model routing, answer caching and quota cooldowns. No network calls."""

import pytest

import ai_cache
import color_providers
import config
from color_providers import ProviderError
from models import ai_cache as cache_collection


@pytest.fixture(autouse=True)
def empty_cache():
    cache_collection.delete_many({})
    yield
    cache_collection.delete_many({})


def test_text_features_use_their_own_model_chain(monkeypatch):
    monkeypatch.setattr(config, "GEMINI_TEXT_MODELS", ("gemini-lite", "gemini-primary"))
    assert color_providers.candidates(text=True)[:2] == [("gemini", "gemini-lite"), ("gemini", "gemini-primary")]
    assert color_providers.candidates()[0] == ("gemini", "gemini-primary")
    assert ("gemini", "gemini-lite") not in color_providers.candidates()


def test_identical_requests_reuse_the_cached_answer_per_user():
    calls = []

    def compute():
        calls.append(1)
        return {"reply": f"answer {len(calls)}"}

    first, first_cached = ai_cache.cached_call("chat", "user-a", "same prompt", compute)
    second, second_cached = ai_cache.cached_call("chat", "user-a", "same prompt", compute)
    other_user, other_cached = ai_cache.cached_call("chat", "user-b", "same prompt", compute)
    assert (first, first_cached) == ({"reply": "answer 1"}, False)
    assert (second, second_cached) == ({"reply": "answer 1"}, True)
    assert other_user == {"reply": "answer 2"} and other_cached is False
    assert len(calls) == 2


def test_failures_are_never_cached():
    def failing():
        raise ProviderError("quota", "quota")

    with pytest.raises(ProviderError):
        ai_cache.cached_call("looks", "user-a", "prompt", failing)
    assert cache_collection.count_documents({}) == 0


def test_exhausted_daily_quota_pauses_the_model_for_an_hour():
    color_providers.reset_state()
    color_providers._start_cooldown(ProviderError("daily quota", "quota", provider="gemini", model="gemini-primary"))
    kind, remaining = color_providers._cooling_down("gemini", "gemini-primary")
    assert kind == "quota" and remaining > 3500
    color_providers.reset_state()


def test_cache_entries_expire_through_a_ttl_index():
    import models
    models.initialize_database()
    indexes = cache_collection.index_information()
    assert indexes["ai_cache_expiry"]["expireAfterSeconds"] == config.AI_CACHE_HOURS * 3600


def _chain_setup(monkeypatch, listed):
    color_providers.reset_state()
    monkeypatch.setattr(config, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(config, "OPENAI_VISION_MODEL", "")
    monkeypatch.setattr(config, "GEMINI_TEXT_MODELS", ("gemini-old-lite",))
    monkeypatch.setattr(config, "GEMINI_AUTO_DISCOVER", True)
    monkeypatch.setattr(color_providers, "_list_models", lambda provider, timeout: frozenset(listed))


def test_retired_models_fall_back_to_a_discovered_stable_flash_model(monkeypatch):
    # Arrange: the configured model is gone; the key can see newer stable and preview models.
    _chain_setup(monkeypatch, {"gemini-9.1-flash-lite", "gemini-9.0-flash", "gemini-9.2-flash-preview", "gemini-flash-latest"})
    tried = []

    def call(provider, model, timeout):
        tried.append(model)
        return {"ok": model}

    # Act
    result, _, model, attempts = color_providers.run_chain(call, 30, text=True)
    # Assert: the retired name is skipped without a call, and only stable names are discovered (lite first for text).
    assert attempts[0]["outcome"] == "model" and tried == ["gemini-9.1-flash-lite"] and result == {"ok": model}
    color_providers.reset_state()


def test_discovery_can_be_switched_off(monkeypatch):
    _chain_setup(monkeypatch, {"gemini-9.0-flash"})
    monkeypatch.setattr(config, "GEMINI_AUTO_DISCOVER", False)
    with pytest.raises(ProviderError):
        color_providers.run_chain(lambda provider, model, timeout: {"ok": 1}, 30, text=True)
    color_providers.reset_state()


def test_a_timed_out_model_is_skipped_briefly_instead_of_eating_every_budget(monkeypatch):
    _chain_setup(monkeypatch, {"gemini-old-lite"})

    def slow(provider, model, timeout):
        raise TimeoutError("timed out")

    with pytest.raises(ProviderError) as error:
        color_providers.run_chain(slow, 30, text=True)
    assert error.value.kind == "temporary"
    kind, remaining = color_providers._cooling_down("gemini", "gemini-old-lite")
    assert kind == "timeout" and 0 < remaining <= color_providers.TIMEOUT_COOLDOWN_SECONDS
    color_providers.reset_state()
