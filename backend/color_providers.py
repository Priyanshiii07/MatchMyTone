"""Selfie color analysis through an ordered chain of verified AI providers.

Gemini models are tried first (primary, then configured fallbacks), followed by
OpenAI when it is configured. Each candidate is called at most once per request
and the whole chain shares one time budget. A result is only ever returned when
a provider produced it and it passed validation; nothing is fabricated.
"""

import json
import logging
import re
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import config


logger = logging.getLogger("matchmytone.color")

GEMINI_BASE = "https://generativelanguage.googleapis.com"
OPENAI_BASE = "https://api.openai.com/v1"
MODEL_LIST_TTL_SECONDS = 300
MIN_ATTEMPT_SECONDS = 5
# Failures after which trying the next candidate can still succeed.
FAILOVER_KINDS = {"temporary", "timeout", "rate_limit", "quota", "model", "malformed"}
# Failures that make every further call to the same provider pointless.
PROVIDER_WIDE_KINDS = {"configuration", "credentials"}
# Cooldowns (seconds) for failures that are certain to repeat on the next request.
# Exhausted quota is usually a daily free-tier limit, so retrying within the hour only wastes requests.
COOLDOWN_SECONDS = {"credentials": 600, "quota": 3600}
# A model that answers 404 has been retired or renamed; one that times out is overloaded. Skip them for a while
# instead of spending every request's time budget on them.
RETIRED_MODEL_SECONDS = 6 * 3600
TIMEOUT_COOLDOWN_SECONDS = 120
# Stable Gemini Flash names (no -preview/-exp/-latest) that may be used when every configured model is unavailable.
STABLE_FLASH = re.compile(r"^gemini-(\d+(?:\.\d+)?)-flash(-lite)?$")
DISCOVERED_MODELS = 2

_model_cache = {"gemini": {"expires": 0, "models": None}, "openai": {"expires": 0, "models": None}}
_cooldowns = {}


class ProviderError(RuntimeError):
    def __init__(self, message, kind="permanent", status=None, retry_after=None, provider=None, model=None, attempts=None):
        super().__init__(message)
        self.kind = kind
        self.status = status
        self.retry_after = retry_after
        self.provider = provider
        self.model = model
        self.attempts = attempts or []


def reset_state():
    """Clear cached model lists and cooldowns (used by tests and after config changes)."""
    for cache in _model_cache.values():
        cache.update({"expires": 0, "models": None})
    _cooldowns.clear()


def build_color_analysis_prompt(previous=None, profile=None):
    repeat = ""
    if previous and previous.get("season_type") and len(previous.get("colors_to_wear", [])) >= 6:
        repeat = f"""
REPEAT ANALYSIS FOR THIS ACCOUNT:
The user has a previous valid analysis. Keep seasonType, undertone, skinAge, colorsToWear, and colorsToAvoid identical unless the new image clearly shows a different person. You may refresh descriptions.
Previous values: {json.dumps({"seasonType": previous.get("season_type"), "undertone": previous.get("undertone"), "skinAge": previous.get("skin_age"), "colorsToWear": previous.get("colors_to_wear"), "colorsToAvoid": previous.get("colors_to_avoid")})}
"""
    # Gender is never sent or requested: the palette must come from the image alone.
    profile_hint = ""
    if profile and profile.get("age") not in (None, ""):
        profile_hint = f"The registered profile indicates age={profile['age']}; use this only as context for the skin-age estimate, never as a substitute for the image."
    return f"""You are an expert personal color analyst. Analyze the actual image, not a canned example. {profile_hint}
{repeat}
If the image does not show one clear face, or the lighting is too dark, overexposed, or strongly colored for a reliable skin-tone reading, return only {{\"isFace\":false,\"description\":\"<short retake guidance, e.g. use indirect natural daylight>\"}}.
Otherwise return only valid JSON with isFace=true, seasonType (a specific seasonal label such as Soft Autumn, Cool Summer, Warm Spring, Deep Winter, Light Summer, Bright Spring, or another appropriate seasonal label), seasonDescription, undertone (exactly Warm, Cool, or Neutral), undertoneDescription, skinAge as an integer visual estimate, skinAgeDescription, exactly 6 colorsToWear and exactly 3 colorsToAvoid. Derive the palette from visible skin depth, undertone, hair/eye contrast, and the season. Lighting, camera white balance, and makeup can shift apparent undertone, so phrase descriptions as an estimate. Every color needs a name and a valid #RRGGBB hex code. Do not include markdown or code fences."""


def _text(value):
    return value.strip() if isinstance(value, str) else ""


def _color_list(items, expected):
    if not isinstance(items, list) or len(items) != expected:
        raise ValueError("The analysis response did not contain complete color recommendations.")
    colors = []
    for item in items:
        name = _text(item.get("name")) if isinstance(item, dict) else ""
        hex_value = _text(item.get("hex")) if isinstance(item, dict) else ""
        if re.fullmatch(r"[0-9a-fA-F]{6}", hex_value):
            hex_value = f"#{hex_value}"
        if not name or not re.fullmatch(r"#[0-9a-fA-F]{6}", hex_value):
            raise ValueError("The analysis response did not contain complete color recommendations.")
        colors.append({"name": name, "hex": hex_value.upper()})
    return colors


def normalize_color_result(data):
    """Validate a provider response and map it onto the application's result schema."""
    if not isinstance(data, dict) or not isinstance(data.get("isFace"), bool):
        raise ValueError("The analysis response was invalid.")
    if not data["isFace"]:
        return {"isFace": False, "description": _text(data.get("description")) or "Please capture a clear, well-lit single-face selfie in indirect natural daylight."}
    skin_age = data.get("skinAge")
    if isinstance(skin_age, float) and skin_age.is_integer():
        skin_age = int(skin_age)
    elif isinstance(skin_age, str) and skin_age.strip().isdigit():
        skin_age = int(skin_age.strip())
    undertone = _text(data.get("undertone")).capitalize()
    season = _text(data.get("seasonType"))
    if not season or undertone not in {"Warm", "Cool", "Neutral"} or isinstance(skin_age, bool) or not isinstance(skin_age, int) or not 0 < skin_age < 120:
        raise ValueError("The analysis response did not contain complete color details.")
    return {
        "isFace": True,
        "description": _text(data.get("description")),
        "seasonType": season,
        "seasonDescription": _text(data.get("seasonDescription")),
        "undertone": undertone,
        "undertoneDescription": _text(data.get("undertoneDescription")),
        "skinAge": skin_age,
        "skinAgeDescription": _text(data.get("skinAgeDescription")),
        "colorsToWear": _color_list(data.get("colorsToWear"), 6),
        "colorsToAvoid": _color_list(data.get("colorsToAvoid"), 3),
    }


def _parse_json_text(raw, provider):
    raw = re.sub(r"```(?:json)?|```", "", raw or "", flags=re.IGNORECASE).strip()
    if not raw:
        raise ValueError(f"{provider} returned an empty analysis response.")
    return json.loads(raw)


def _error_body(error):
    try:
        body = json.loads(error.read().decode("utf-8", errors="replace") or "{}")
    except (ValueError, OSError):
        return {}
    return body.get("error", {}) if isinstance(body, dict) and isinstance(body.get("error"), dict) else {}


def _seconds(value):
    match = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*s?\s*", str(value or ""))
    return float(match.group(1)) if match else None


def _classify_gemini_http_error(error, model):
    body = _error_body(error)
    message = str(body.get("message", "")).lower()
    details = [item for item in body.get("details", []) if isinstance(item, dict)]
    retry_after = next((_seconds(item.get("retryDelay")) for item in details if "retryDelay" in item), None)
    quota_ids = [str(violation.get("quotaId", "")) for item in details for violation in item.get("violations", []) if isinstance(violation, dict)]
    reasons = {str(item.get("reason", "")) for item in details}
    code = error.code
    if code in {401, 403} or "API_KEY_INVALID" in reasons or "api key not valid" in message:
        if "billing" in message:
            return ProviderError("Gemini requires billing to be enabled for this project.", "quota", code, provider="gemini", model=model)
        return ProviderError("Gemini rejected its API key or model access.", "credentials", code, provider="gemini", model=model)
    if code == 404:
        return ProviderError(f"Gemini model '{model}' is not available to this API key.", "model", code, provider="gemini", model=model)
    if code == 429:
        exhausted = any("PerDay" in quota_id for quota_id in quota_ids) or "billing" in message
        if exhausted:
            return ProviderError(f"Gemini quota for '{model}' is exhausted.", "quota", code, retry_after, "gemini", model)
        return ProviderError(f"Gemini rate limit reached for '{model}'.", "rate_limit", code, retry_after, "gemini", model)
    if code in {500, 502, 503, 504}:
        return ProviderError(f"Gemini model '{model}' is temporarily unavailable.", "temporary", code, provider="gemini", model=model)
    # 400-class request errors are specific to this model's accepted parameters.
    return ProviderError(f"Gemini model '{model}' rejected the analysis request.", "model", code, provider="gemini", model=model)


def _classify_openai_http_error(error, model):
    body = _error_body(error)
    code = error.code
    error_code = str(body.get("code") or "")
    error_type = str(body.get("type") or "")
    retry_after = _seconds(error.headers.get("retry-after") if error.headers else None)
    if code in {401, 403}:
        return ProviderError("OpenAI rejected its API key or model access.", "credentials", code, provider="openai", model=model)
    if code == 404:
        return ProviderError(f"OpenAI model '{model}' is not available to this API key.", "model", code, provider="openai", model=model)
    if code == 429:
        if "insufficient_quota" in {error_code, error_type} or "credit" in error_code or "billing" in error_code:
            return ProviderError("OpenAI account quota or credit is exhausted.", "quota", code, provider="openai", model=model)
        return ProviderError("OpenAI rate limit reached.", "rate_limit", code, retry_after, "openai", model)
    if code in {500, 502, 503, 504}:
        return ProviderError("OpenAI is temporarily unavailable.", "temporary", code, provider="openai", model=model)
    return ProviderError("OpenAI rejected the analysis request.", "model", code, provider="openai", model=model)


def _list_models(provider, timeout):
    """Return the provider's usable model ids, or None when the list could not be fetched."""
    cache = _model_cache[provider]
    now = time.monotonic()
    if cache["models"] is not None and cache["expires"] > now:
        return cache["models"]
    if provider == "gemini":
        request = Request(f"{GEMINI_BASE}/{config.GEMINI_API_VERSION}/models?pageSize=1000", headers={"x-goog-api-key": config.GEMINI_API_KEY})
    else:
        request = Request(f"{OPENAI_BASE}/models", headers={"Authorization": f"Bearer {config.OPENAI_API_KEY}"})
    try:
        body = json.loads(urlopen(request, timeout=timeout).read().decode("utf-8"))
    except HTTPError as error:
        if error.code in {401, 403}:
            error.read()
            raise ProviderError(f"{provider.title()} rejected its API key.", "credentials", error.code, provider=provider) from error
        logger.warning("Model list unavailable provider=%s status=%s", provider, error.code)
        return None
    except (URLError, TimeoutError, ValueError, OSError):
        logger.warning("Model list unavailable provider=%s", provider)
        return None
    if provider == "gemini":
        models = frozenset(str(item.get("name", "")).removeprefix("models/") for item in body.get("models", []) if "generateContent" in item.get("supportedGenerationMethods", []))
    else:
        models = frozenset(str(item.get("id", "")) for item in body.get("data", []))
    cache.update({"expires": now + MODEL_LIST_TTL_SECONDS, "models": models})
    return models


def _gemini_generation(json_output=True, max_tokens=4096, temperature=0.2, thinking=True):
    generation = {"maxOutputTokens": max_tokens, "temperature": temperature}
    if json_output:
        generation["responseMimeType"] = "application/json"
    if thinking and config.GEMINI_THINKING_LEVEL:
        generation["thinkingConfig"] = {"thinkingLevel": config.GEMINI_THINKING_LEVEL}
    return generation


def _post_gemini(model, body, timeout):
    """POST generateContent and return the first candidate; HTTP errors are classified for failover."""
    request = Request(f"{GEMINI_BASE}/{config.GEMINI_API_VERSION}/models/{model}:generateContent", data=json.dumps(body).encode("utf-8"), headers={"Content-Type": "application/json", "x-goog-api-key": config.GEMINI_API_KEY}, method="POST")
    try:
        response = json.loads(urlopen(request, timeout=timeout).read().decode("utf-8"))
    except HTTPError as error:
        raise _classify_gemini_http_error(error, model) from error
    candidate = (response.get("candidates") or [{}])[0]
    if candidate.get("finishReason") in {"SAFETY", "PROHIBITED_CONTENT", "RECITATION"}:
        raise ValueError("Gemini declined the request.")
    return candidate


def _candidate_text(candidate):
    parts = candidate.get("content", {}).get("parts", [])
    return "".join(part.get("text", "") for part in parts if isinstance(part, dict) and not part.get("thought"))


def _call_gemini(model, image, mime_type, prompt, timeout):
    parts = [{"text": prompt}] + ([{"inlineData": {"data": image, "mimeType": mime_type}}] if image else [])
    # Thinking settings matter for image analysis; the lite text models don't need them.
    candidate = _post_gemini(model, {"contents": [{"parts": parts}], "generationConfig": _gemini_generation(thinking=bool(image))}, timeout)
    return _parse_json_text(_candidate_text(candidate), "Gemini")


OPENAI_COLOR_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "isFace": {"type": "boolean"},
        "description": {"type": "string"},
        "seasonType": {"type": ["string", "null"]},
        "seasonDescription": {"type": "string"},
        "undertone": {"type": ["string", "null"], "enum": ["Warm", "Cool", "Neutral", None]},
        "undertoneDescription": {"type": "string"},
        "skinAge": {"type": ["integer", "null"]},
        "skinAgeDescription": {"type": "string"},
        "colorsToWear": {"type": "array", "items": {"type": "object", "additionalProperties": False, "properties": {"name": {"type": "string"}, "hex": {"type": "string"}}, "required": ["name", "hex"]}},
        "colorsToAvoid": {"type": "array", "items": {"type": "object", "additionalProperties": False, "properties": {"name": {"type": "string"}, "hex": {"type": "string"}}, "required": ["name", "hex"]}},
    },
    "required": ["isFace", "description", "seasonType", "seasonDescription", "undertone", "undertoneDescription", "skinAge", "skinAgeDescription", "colorsToWear", "colorsToAvoid"],
}


def _openai_text(body):
    if isinstance(body.get("output_text"), str) and body["output_text"].strip():
        return body["output_text"]
    for item in body.get("output", []):
        for content in item.get("content", []) if isinstance(item, dict) else []:
            if isinstance(content, dict) and content.get("type") == "refusal":
                raise ValueError("OpenAI declined to analyze this image.")
            if isinstance(content, dict) and content.get("type") in {"output_text", "text"} and content.get("text"):
                return content["text"]
    return ""


def _call_openai(model, image, mime_type, prompt, timeout):
    if image:
        prompt += " Return every schema field. If the image is not suitable, set isFace=false, use null for uncertain scalar fields, empty arrays, and explain the retake guidance in description."
        content = [{"type": "input_text", "text": prompt}, {"type": "input_image", "image_url": f"data:{mime_type};base64,{image}", "detail": "high"}]
        text_format = {"type": "json_schema", "name": "matchmytone_color_analysis", "strict": True, "schema": OPENAI_COLOR_SCHEMA}
    else:
        # Text-only JSON requests (recommendation explanations); the caller validates the structure.
        content = [{"type": "input_text", "text": prompt}]
        text_format = {"type": "json_object"}
    payload = json.dumps({
        "model": model,
        "input": [{"role": "user", "content": content}],
        "text": {"format": text_format},
        "max_output_tokens": 1500,
    }).encode("utf-8")
    request = Request(f"{OPENAI_BASE}/responses", data=payload, headers={"Content-Type": "application/json", "Authorization": f"Bearer {config.OPENAI_API_KEY}"}, method="POST")
    try:
        body = json.loads(urlopen(request, timeout=timeout).read().decode("utf-8"))
    except HTTPError as error:
        raise _classify_openai_http_error(error, model) from error
    return _parse_json_text(_openai_text(body), "OpenAI")


PROVIDERS = {
    "gemini": {"key": lambda: config.GEMINI_API_KEY, "timeout": lambda: config.GEMINI_TIMEOUT_SECONDS, "call": _call_gemini},
    "openai": {"key": lambda: config.OPENAI_API_KEY, "timeout": lambda: config.OPENAI_TIMEOUT_SECONDS, "call": _call_openai},
}


def candidates(text=False):
    """Ordered (provider, model) pairs from configuration, without duplicates.

    ``text=True`` selects the text-only chain (GEMINI_TEXT_MODELS) used by stylist features.
    """
    gemini_models = config.GEMINI_TEXT_MODELS if text else (config.GEMINI_MODEL, *config.GEMINI_FALLBACK_MODELS)
    ordered = [("gemini", model) for model in gemini_models if model]
    if config.OPENAI_VISION_MODEL:
        ordered.append(("openai", config.OPENAI_VISION_MODEL))
    return list(dict.fromkeys(ordered))


def _discovered_gemini(text, configured, timeout):
    """Up to DISCOVERED_MODELS stable Flash models this key can use, newest first, that are not already configured.

    Keeps AI features working when Google retires the configured model names; lite models lead for text."""
    if not config.GEMINI_AUTO_DISCOVER or not config.GEMINI_API_KEY:
        return []
    try:
        listed = _list_models("gemini", timeout) or ()
    except ProviderError:
        return []
    found = [(float(match.group(1)), bool(match.group(2)), name) for name in listed if (match := STABLE_FLASH.match(name)) and name not in configured]
    found.sort(key=lambda item: (item[1] != text, -item[0]))
    return [("gemini", name) for _, _, name in found[:DISCOVERED_MODELS]]


def _ordered_candidates(text, timeout, skipped_providers):
    """Configured candidates in order; discovered Gemini models are looked up lazily, only once every configured
    Gemini model has been tried without success and Gemini itself is still usable."""
    ordered = candidates(text)
    configured = {model for provider, model in ordered if provider == "gemini"}
    split = next((index for index, (provider, _) in enumerate(ordered) if provider != "gemini"), len(ordered))
    yield from ordered[:split]
    if "gemini" not in skipped_providers:
        yield from _discovered_gemini(text, configured, timeout)
    yield from ordered[split:]


def _cooldown_key(provider, model, kind, scope="default"):
    # Bad keys or configuration affect every request; quota and rate limits are tracked per scope,
    # so an exhausted Google Search grounding quota never blocks ordinary color analysis.
    if kind in PROVIDER_WIDE_KINDS:
        return ("default", provider, None)
    return (scope, provider, None if provider == "openai" else model)


def _start_cooldown(error, scope="default"):
    seconds = COOLDOWN_SECONDS.get(error.kind) or (error.retry_after if error.kind == "rate_limit" else None)
    if seconds:
        _cooldowns[_cooldown_key(error.provider, error.model, error.kind, scope)] = (time.monotonic() + seconds, error.kind)


def _cooling_down(provider, model, scope="default"):
    now = time.monotonic()
    for key in dict.fromkeys((("default", provider, None), ("default", provider, model), (scope, provider, None), (scope, provider, model))):
        until, kind = _cooldowns.get(key, (0, None))
        if until > now:
            return kind, until - now
    return None


def _summarize_failure(attempts):
    kinds = {attempt["outcome"] for attempt in attempts}
    retry_after = min((attempt["retryAfter"] for attempt in attempts if attempt.get("retryAfter")), default=None)
    if not attempts:
        return ProviderError("No AI provider is configured. Add GEMINI_API_KEY or OPENAI_API_KEY to backend/.env.", "configuration", attempts=attempts)
    if kinds <= {"temporary", "timeout", "rate_limit", "budget"}:
        return ProviderError("The AI analysis service is busy right now. Your selfie is kept, so please retry in a moment.", "temporary", retry_after=retry_after, attempts=attempts)
    if kinds <= {"configuration", "credentials", "quota", "model"}:
        return ProviderError("AI analysis is unavailable because no configured AI provider currently has valid access or remaining quota.", "unavailable", retry_after=retry_after, attempts=attempts)
    if kinds <= {"malformed"}:
        return ProviderError("The AI provider returned an incomplete analysis. Please retake your selfie in even, natural light and try again.", "malformed", attempts=attempts)
    return ProviderError("All configured AI providers failed to analyze this selfie. Your selfie is kept, so please retry in a moment.", "temporary", retry_after=retry_after, attempts=attempts)


def analyze_color(image, mime_type, previous=None, profile=None, budget_seconds=None):
    """Run the provider chain. Returns (result, provider, model, attempts) or raises ProviderError."""
    prompt = build_color_analysis_prompt(previous, profile)

    def call(provider, model, timeout):
        return normalize_color_result(PROVIDERS[provider]["call"](model, image, mime_type, prompt, timeout))

    return run_chain(call, budget_seconds or config.COLOR_ANALYSIS_MAX_SECONDS, label="Color analysis")


def run_chain(call, budget_seconds, providers=None, label="AI request", scope="default", text=False):
    """Try each configured (provider, model) at most once within one time budget.

    ``call(provider, model, timeout)`` returns a validated result or raises; failures are classified,
    cooled down and moved past exactly as for color analysis. Returns (result, provider, model, attempts).
    """
    started = time.monotonic()
    deadline = started + budget_seconds
    attempts = []
    skipped_providers = set()
    for provider, model in _ordered_candidates(text, min(10, budget_seconds), skipped_providers):
        if providers and provider not in providers:
            continue
        spec = PROVIDERS[provider]
        attempt = {"provider": provider, "model": model}
        if provider in skipped_providers:
            continue
        if not spec["key"]():
            skipped_providers.add(provider)
            attempts.append({**attempt, "outcome": "configuration", "ms": 0})
            continue
        cooling = _cooling_down(provider, model, scope)
        if cooling:
            attempts.append({**attempt, "outcome": cooling[0], "ms": 0, "retryAfter": round(cooling[1]), "skipped": "cooldown"})
            continue
        remaining = deadline - time.monotonic()
        if remaining < MIN_ATTEMPT_SECONDS:
            attempts.append({**attempt, "outcome": "budget", "ms": 0})
            break
        attempt_started = time.monotonic()
        try:
            listed = _list_models(provider, min(10, remaining))
            if listed is not None and model not in listed:
                raise ProviderError(f"{provider.title()} model '{model}' is not available to this API key.", "model", provider=provider, model=model)
            timeout = min(spec["timeout"](), deadline - time.monotonic())
            result = call(provider, model, timeout)
        except ProviderError as error:
            error.provider, error.model = provider, error.model or model
            attempts.append({**attempt, "outcome": error.kind, "status": error.status, "ms": round((time.monotonic() - attempt_started) * 1000), **({"retryAfter": error.retry_after} if error.retry_after else {})})
            logger.warning("%s attempt provider=%s model=%s outcome=%s status=%s ms=%d", label, provider, model, error.kind, error.status, attempts[-1]["ms"])
            _start_cooldown(error, scope)
            if error.kind == "model" and error.status == 404:
                _cooldowns[("default", provider, model)] = (time.monotonic() + RETIRED_MODEL_SECONDS, "model")
            if error.kind in PROVIDER_WIDE_KINDS or (provider == "openai" and error.kind == "quota"):
                skipped_providers.add(provider)
            continue
        except (URLError, TimeoutError, OSError) as error:
            outcome = "timeout" if isinstance(error, TimeoutError) or "timed out" in str(error).lower() else "temporary"
            attempts.append({**attempt, "outcome": outcome, "ms": round((time.monotonic() - attempt_started) * 1000)})
            logger.warning("%s attempt provider=%s model=%s outcome=%s ms=%d", label, provider, model, outcome, attempts[-1]["ms"])
            if outcome == "timeout":
                _cooldowns[(scope, provider, None if provider == "openai" else model)] = (time.monotonic() + TIMEOUT_COOLDOWN_SECONDS, "timeout")
            continue
        except (ValueError, TypeError, AttributeError, KeyError, IndexError):
            attempts.append({**attempt, "outcome": "malformed", "ms": round((time.monotonic() - attempt_started) * 1000)})
            logger.warning("%s attempt provider=%s model=%s outcome=malformed", label, provider, model)
            continue
        attempts.append({**attempt, "outcome": "success", "ms": round((time.monotonic() - attempt_started) * 1000)})
        logger.info("%s provider=%s model=%s duration_ms=%d attempts=%s", label, provider, model, (time.monotonic() - started) * 1000, [(item["model"], item["outcome"], item["ms"]) for item in attempts])
        return result, provider, model, attempts
    raise _summarize_failure(attempts)
