"""AI-written personal explanations for an existing recommendation set.

The deterministic engine (styling.py / skincare.py) decides *what* is recommended. The AI only
explains *why* those exact items may suit this user: it may reference item ids it was given and
nothing else, its text is length-capped and stripped of markup and links, and a failure leaves the
saved recommendations untouched.
"""

import json
import re

import ai_cache
import color_providers
import config
from models import utc_now

MAX_NOTES = 12
URL = re.compile(r"(https?://|www\.)\S+", re.IGNORECASE)
MEDICAL = re.compile(r"\b(cure[sd]?|diagnos\w*|prescri\w*|clinically proven|guarantee\w*)\b", re.IGNORECASE)
MODULE_NAMES = {"body_shape": "body-shape styling", "face_shape": "face-shape styling", "color_analysis": "seasonal color styling", "skincare": "skincare routine"}


def clean(text, limit):
    """Plain text only: no markup, links or control characters, capped in length."""
    if not isinstance(text, str):
        return ""
    text = URL.sub("", text)
    text = re.sub(r"[<>`*#]", "", text)
    text = re.sub(r"[\x00-\x1f\x7f]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()[:limit].rstrip()


def _items(kind, doc):
    """(id, label) pairs the AI may comment on, taken from the saved recommendations."""
    if kind == "skincare":
        plan = doc.get("plan") or {}
        return [(p["id"], f"{p.get('brand', '')} {p.get('name', '')} ({p.get('category', '')})") for p in plan.get("products", []) if p.get("id")]
    snapshot = doc.get("styling") or {}
    if kind == "color_analysis":
        return [(o["id"], f"{o['title']}: " + ", ".join(f"{p['piece']} in {p['name']}" for p in o.get("pieces", []))) for o in snapshot.get("outfits", [])]
    if kind == "face_shape":
        cards = [card for key in ("hair", "eyewear", "accessories") for card in snapshot.get(key, [])]
    else:
        cards = snapshot.get("items", [])
    return [(card["id"], f"{card['title']} ({card.get('category') or card.get('group', '')})") for card in cards[:MAX_NOTES * 2]]


def _context(kind, doc):
    snapshot = doc.get("styling") or {}
    prefs = snapshot.get("preferences") or {}
    lines = [f"Module: {MODULE_NAMES[kind]}."]
    if kind == "color_analysis":
        palette = ", ".join(f"{c.get('name')} {c.get('hex')}" for c in doc.get("colors_to_wear", []) if isinstance(c, dict))
        lines.append(f"Seasonal palette: {doc.get('season_type')}; undertone: {doc.get('undertone')}; recommended colors: {palette}.")
    elif kind == "skincare":
        plan = doc.get("plan") or {}
        lines.append(f"Skin type from the questionnaire: {plan.get('skin_type')}; concerns: {', '.join(plan.get('concerns', [])) or 'none reported'}; routine extras chosen: {', '.join(plan.get('extras', [])) or 'none'}.")
    else:
        lines.append(f"Questionnaire result: {doc.get('result')} {'face' if kind == 'face_shape' else 'body'} shape.")
    if kind != "skincare":
        lines.append(f"Styling catalog chosen by the user: {snapshot.get('catalog_label', 'not set')}. Preferences: {json.dumps({k: v for k, v in prefs.items() if k not in {'catalog', 'catalog_source'}})}.")
    return "\n".join(lines)


def build_prompt(kind, doc):
    items = _items(kind, doc)
    listing = "\n".join(f"- {item_id}: {label}" for item_id, label in items)
    rules = "General wellness information only: never diagnose, never promise results, never claim a product treats a condition, and suggest a dermatologist for persistent problems." if kind == "skincare" else "Never comment on attractiveness or weight, never shame, never invent measurements, and treat every idea as optional."
    return f"""You are MatchMyTone's personal stylist. Write short, warm, specific explanations for recommendations that have ALREADY been chosen for this user.
{_context(kind, doc)}
Recommendations (id: description):
{listing}
Rules: {rules} Do not add, remove or rename recommendations, do not mention brands or products that are not listed, do not include links, prices, ratings or popularity claims, and do not mention gender unless the user's chosen catalog requires it.
Return only JSON: {{"summary": "<2-3 sentences tying the result and preferences together>", "notes": [{{"id": "<one of the ids above>", "note": "<one sentence on why it may suit this user>"}}], "tips": ["<up to 3 short practical tips>"]}}"""


def normalize(data, allowed_ids):
    if not isinstance(data, dict):
        raise ValueError("Insights must be an object.")
    summary = clean(data.get("summary"), 700)
    if len(summary) < 20 or MEDICAL.search(summary):
        raise ValueError("Insights summary missing or unsafe.")
    notes = {}
    for entry in data.get("notes") if isinstance(data.get("notes"), list) else []:
        if isinstance(entry, dict) and entry.get("id") in allowed_ids and entry["id"] not in notes:
            note = clean(entry.get("note"), 280)
            if note and not MEDICAL.search(note):
                notes[entry["id"]] = note
        if len(notes) >= MAX_NOTES:
            break
    raw_tips = data.get("tips") if isinstance(data.get("tips"), list) else []
    tips = [tip for tip in (clean(item, 220) for item in raw_tips[:3]) if tip and not MEDICAL.search(tip)]
    return {"summary": summary, "notes": notes, "tips": tips}


def generate(kind, doc, user_id=None):
    """Returns (insights, provider, model). Raises color_providers.ProviderError when every provider fails.

    An identical request (same result, recommendations and catalog) within the cache window reuses the
    stored answer instead of calling the AI again; provider and model are then reported as "cache".
    """
    allowed = {item_id for item_id, _ in _items(kind, doc)}
    if not allowed:
        raise ValueError("There are no recommendations to explain yet.")
    prompt = build_prompt(kind, doc)

    def call(provider, model, timeout):
        return normalize(color_providers.PROVIDERS[provider]["call"](model, None, None, prompt, timeout), allowed)

    def compute():
        result, provider, model, _ = color_providers.run_chain(call, config.AI_TEXT_MAX_SECONDS, label="Recommendation insights", text=True)
        return {"result": result, "provider": provider, "model": model}

    value, cached = ai_cache.cached_call("insights", user_id or doc.get("user_id"), prompt, compute)
    result, provider, model = value["result"], ("cache" if cached else value["provider"]), ("cache" if cached else value["model"])
    snapshot = doc.get("styling") or {}
    return {**result, "generated_at": utc_now(), "catalog": snapshot.get("catalog"), "catalog_version": snapshot.get("catalog_version") or (doc.get("plan") or {}).get("catalog_version")}, provider, model
