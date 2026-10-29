"""AI stylist chat and occasion look generator, grounded in the signed-in user's own saved results.

Both features read only the current user's latest saved analyses (never another user's) and never
re-run an image analysis. Looks are assembled from catalog items and the user's real palette; the
AI may only choose among those ids and colours. When every AI provider fails, looks fall back to a
clearly labelled rule-based set and chat reports the failure honestly.
"""

import logging
import re
import threading
import time

from flask import Blueprint, jsonify, request

import ai_cache
import color_providers
import config
import personalization
import preferences
import styling
from ai_insights import MEDICAL, URL, clean
from auth_helpers import current_user, require_user
from color_providers import ProviderError
from models import analysis_collections

logger = logging.getLogger("matchmytone.stylist")
bp = Blueprint("stylist", __name__)
KINDS = ("color_analysis", "skincare", "face_shape", "body_shape")
MAX_TURNS = 10
COOLDOWN_SECONDS = {"chat": 2, "looks": 8}
_active, _recent = set(), {}
_guard = threading.Lock()


# ---------- shared context ----------

def latest_results(user):
    docs = {}
    for kind in KINDS:
        query = {"user_id": user["id"], **({"is_face": True} if kind == "color_analysis" else {})}
        doc = analysis_collections[kind].find_one(query, {"_id": 0}, sort=[("created_at", -1)])
        if doc:
            docs[kind] = personalization.attach_styling(kind, doc, user)
    return docs


def describe(docs, prefs):
    """Plain-text summary of the user's saved results for the AI; contains no personal identifiers."""
    lines = [f"Styling catalog: {styling.CATALOG['catalog_labels'][prefs['catalog']]}" + (" (not chosen yet — keep suggestions neutral)" if prefs["needs_choice"] else "") + "."]
    color = docs.get("color_analysis")
    if color:
        palette = ", ".join(f"{c['name']} {c['hex']}" for c in styling.palette_colors(color))
        lines.append(f"Color analysis: {color.get('season_type')} season, {color.get('undertone')} undertone. Palette: {palette}.")
    skin = docs.get("skincare")
    if skin and skin.get("plan"):
        plan = skin["plan"]
        products = "; ".join(f"{p['brand']} {p['name']} ({p['category']})" for p in plan.get("products", []))
        lines.append(f"Skincare: {plan.get('skin_type')}; concerns: {', '.join(plan.get('concerns', [])) or 'none'}; products in their routine (the ONLY products you may name): {products}.")
    face = docs.get("face_shape")
    if face:
        hair = ", ".join(card["title"] for card in (face.get("styling") or {}).get("hair", [])[:5])
        lines.append(f"Face shape (questionnaire): {face.get('result')}; suggested hairstyles: {hair}.")
    body = docs.get("body_shape")
    if body:
        items = ", ".join(card["title"] for card in (body.get("styling") or {}).get("items", [])[:10])
        lines.append(f"Body shape (questionnaire): {body.get('result')}; suggested pieces: {items}.")
    if prefs.get("occasions"):
        lines.append(f"Occasions they dress for: {', '.join(prefs['occasions'])}.")
    if len(lines) == 1:
        lines.append("No analyses saved yet.")
    return "\n".join(lines)


def _claim(user_id, feature):
    key = (user_id, feature)
    with _guard:
        if key in _active or time.monotonic() < _recent.get(key, 0):
            return None
        _active.add(key)
    return key


def _release(key, feature):
    with _guard:
        _active.discard(key)
        _recent[key] = time.monotonic() + COOLDOWN_SECONDS[feature]


def clean_reply(text, limit=1500):
    """Chat text: line breaks and simple bullets kept; markup, links and control characters removed."""
    if not isinstance(text, str):
        return ""
    text = URL.sub("", text)
    text = re.sub(r"[<>`*#]", "", text)
    text = re.sub(r"[\x00-\x09\x0b-\x1f\x7f]+", " ", text)
    text = re.sub(r"[ \t]+", " ", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()[:limit].rstrip()


def _busy():
    return jsonify({"error": "Your stylist is still working on the last request.", "errorCode": "stylist_busy"}), 429


def _provider_failure(error, what):
    logger.warning("%s failed outcome=%s", what, error.kind)
    return jsonify({"error": "Your AI stylist is unavailable right now. Your saved results are safe — please try again shortly.", "errorCode": f"provider_{error.kind}", "retryable": error.kind in {"temporary", "malformed", "timeout", "rate_limit"}}), 503


# ---------- chat ----------

def chat_prompt(context, messages, module):
    transcript = "\n".join(f"{'User' if m['role'] == 'user' else 'Stylist'}: {m['content']}" for m in messages)
    focus = f"The user is currently looking at their {module.replace('_', ' ')} result." if module else ""
    return f"""You are MatchMyTone's friendly AI personal stylist. Answer using ONLY this user's saved results below. {focus}
{context}
Rules: be concise (under 170 words), practical and kind. Never invent products, brands, prices, links, ratings or statistics; only name skincare products listed above. Skincare is general information, never a diagnosis — suggest a dermatologist for persistent problems. Respect the styling catalog; never assume gender from anything else. Never suggest beard, moustache or other facial-hair styling. If the needed analysis is missing, say which analysis to run.
Conversation so far:
{transcript}
Return only JSON: {{"reply": "<your answer; use short '- ' bullets when listing>", "follow_ups": ["<up to 3 short follow-up questions the user might ask next>"]}}"""


def validate_messages(raw):
    if not isinstance(raw, list) or not raw:
        return None
    messages = []
    for entry in raw[-MAX_TURNS:]:
        if not isinstance(entry, dict) or entry.get("role") not in {"user", "assistant"} or not isinstance(entry.get("content"), str):
            return None
        content = clean_reply(entry["content"], 1000)
        if content:
            messages.append({"role": entry["role"], "content": content})
    return messages if messages and messages[-1]["role"] == "user" else None


def normalize_chat(data):
    if not isinstance(data, dict):
        raise ValueError("Chat reply must be an object.")
    reply = clean_reply(data.get("reply"))
    if len(reply) < 2 or MEDICAL.search(reply):
        raise ValueError("Chat reply missing or unsafe.")
    follow_ups = [clean(item, 120) for item in (data.get("follow_ups") if isinstance(data.get("follow_ups"), list) else [])[:3]]
    return {"reply": reply, "follow_ups": [item for item in follow_ups if item]}


@bp.post("/api/stylist/chat")
@require_user
def chat():
    data = request.get_json(silent=True) or {}
    messages = validate_messages(data.get("messages"))
    if not messages:
        return jsonify({"error": "Send a message to your stylist.", "errorCode": "invalid_messages"}), 400
    module = data.get("module") if data.get("module") in KINDS else None
    user = current_user()
    key = _claim(user["id"], "chat")
    if not key:
        return _busy()
    try:
        prefs = personalization.resolved_preferences(user)
        prompt = chat_prompt(describe(latest_results(user), prefs), messages, module)

        def call(provider, model, timeout):
            return normalize_chat(color_providers.PROVIDERS[provider]["call"](model, None, None, prompt, timeout))

        def compute():
            result, provider, model, _ = color_providers.run_chain(call, config.AI_TEXT_MAX_SECONDS, label="Stylist chat", text=True)
            logger.info("Stylist chat answered provider=%s model=%s", provider, model)
            return result

        answer, cached = ai_cache.cached_call("chat", user["id"], prompt, compute)
    except ProviderError as error:
        return _provider_failure(error, "Stylist chat")
    finally:
        _release(key, "chat")
    return jsonify({**answer, "cached": cached})


# ---------- occasion looks ----------

def look_pool(prefs, occasion, comfort, category):
    modest = "modest" in prefs["style_extras"]
    items = [item for item in styling.CATALOG["body_items"] if styling._in_catalog(item, prefs["catalog"]) and not (modest and "revealing" in item.get("flags", []))]
    for_occasion = [item for item in items if occasion in item.get("occasions", [])] or items
    if comfort:
        # Footwear and accessories have no fit, so they always stay available.
        for_occasion = [item for item in for_occasion if not item.get("fits") or comfort in item["fits"]]
    if category:
        for_occasion.sort(key=lambda item: item["category"] != category)
    return for_occasion


FULL_GARMENTS = {"kurta", "kurta-set", "kurta-w", "sherwani", "saree", "lehenga"}
COMPLETE_OUTFITS = {"saree", "lehenga", "kurta-set"}
RELATED_OCCASIONS = {
    "wedding": ("formal", "festive", "party", "office"), "formal": ("wedding", "office", "party"), "festive": ("wedding", "party", "formal"),
    "office": ("formal", "everyday"), "party": ("formal", "everyday"), "college": ("everyday", "travel"), "travel": ("everyday", "college"), "everyday": ("college", "travel"),
}


def rule_looks(pool, shape, colors, count=2, catalog_items=(), occasion=None):
    """Deterministic looks: a top (or dress), bottom, layer and shoes, coloured from the palette.

    A slot with nothing tagged for the occasion borrows from closely related occasions, so a
    wedding look still gets a shirt and shoes rather than two lonely pieces.
    """
    def by_shape(items):
        return sorted(items, key=lambda item: -(3 if shape in item.get("shapes", {}) else 0))

    related = set(RELATED_OCCASIONS.get(occasion, ()))
    ranked = by_shape(pool)
    borrowed = by_shape([item for item in catalog_items if related & set(item.get("occasions", [])) and item not in pool])
    slots = [("tops", "dresses"), ("bottoms",), ("outerwear", "traditional"), ("footwear",)]
    looks = []
    for index in range(count):
        pieces, used = [], set()
        for categories in slots:
            options = [item for item in ranked if item["category"] in categories] or [item for item in borrowed if item["category"] in categories]
            if not options:
                continue
            item = options[index % len(options)]
            if pieces and pieces[0]["category"] == "dresses" and "bottoms" in categories:
                continue
            color = styling.pick(colors, item.get("role", "neutral"), used)
            used.update(c["hex"] for c in color)
            pieces.append({"item": item, "hex": color[0]["hex"] if color else None, "category": item["category"]})
        arts = {piece["item"]["art"] for piece in pieces}
        if arts & COMPLETE_OUTFITS:
            # Sarees, lehengas and kurta sets are whole outfits: no separate top or bottom.
            pieces = [piece for piece in pieces if piece["category"] not in {"tops", "bottoms"}]
        elif arts & FULL_GARMENTS:
            # A kurta or sherwani is the whole top half; a separate top would double up.
            pieces = [piece for piece in pieces if piece["category"] != "tops"]
        if len(pieces) >= 2:
            looks.append({"title": " + ".join(piece["item"]["title"] for piece in pieces[:2]), "pieces": pieces, "why": "Built from your catalog, body-shape result and palette by our styling rules."})
    return looks


def looks_prompt(context, pool, colors, occasion_label, shape):
    listing = "\n".join(f"- {item['id']}: {item['title']} ({item['category']})" for item in pool[:30])
    palette = ", ".join(f"{c['name']} {c['hex']}" for c in colors) or "no palette saved — leave hex empty"
    return f"""You are MatchMyTone's AI stylist. Create 3 coordinated outfits for: {occasion_label}.
{context}
Body shape result: {shape or 'not saved'}. Use ONLY these pieces (id: name):
{listing}
Use ONLY these colours: {palette}.
Each outfit: 2-5 pieces from the list, each with one colour hex from the palette (or "" if none). Explain in one or two sentences why it suits this user's result and occasion. No prices, brands, links or shops, and no beard or moustache styling.
Return only JSON: {{"looks": [{{"title": "<short name>", "pieces": [{{"item_id": "<id>", "hex": "<#RRGGBB or empty>"}}], "why": "<explanation>"}}]}}"""


def normalize_looks(data, pool_ids, palette_hexes):
    looks = []
    for raw in (data.get("looks") if isinstance(data, dict) and isinstance(data.get("looks"), list) else [])[:3]:
        pieces = []
        for piece in raw.get("pieces", []) if isinstance(raw, dict) and isinstance(raw.get("pieces"), list) else []:
            hex_value = str(piece.get("hex") or "").upper() if isinstance(piece, dict) else ""
            if not isinstance(piece, dict) or piece.get("item_id") not in pool_ids or (hex_value and hex_value not in palette_hexes):
                raise ValueError("A look used a piece or colour outside the allowed set.")
            if piece["item_id"] not in {p["item_id"] for p in pieces}:
                pieces.append({"item_id": piece["item_id"], "hex": hex_value or None})
        title, why = clean(raw.get("title"), 80), clean(raw.get("why"), 400)
        if 2 <= len(pieces) <= 5 and title and why and not MEDICAL.search(why):
            looks.append({"title": title, "pieces": pieces, "why": why})
    if not looks:
        raise ValueError("No valid looks in the response.")
    return looks


def _public_look(look, items_by_id, occasion):
    pieces = []
    for piece in look["pieces"]:
        item = piece["item"] if "item" in piece else items_by_id[piece["item_id"]]
        pieces.append({"item_id": item["id"], "title": item["title"], "category": item["category"], "art": item["art"], "photo": item.get("photo"), "hex": piece.get("hex")})
    return {"title": look["title"], "occasion": occasion, "pieces": pieces, "why": look["why"]}


@bp.post("/api/stylist/looks")
@require_user
def generate_looks():
    data = request.get_json(silent=True) or {}
    occasion = data.get("occasion")
    if occasion not in styling.CATALOG["occasion_labels"]:
        return jsonify({"error": "Choose an occasion.", "errorCode": "invalid_occasion"}), 400
    overrides, error = preferences.validate_preferences({key: data[key] for key in ("catalog",) if data.get(key)})
    comfort = data.get("comfort") if data.get("comfort") in preferences.ALLOWED["fit"] - {"no_preference"} else None
    category = data.get("category") if data.get("category") in {c["id"] for c in styling.CATALOG["body_categories"]} else None
    if error:
        return jsonify({"error": error, "errorCode": "invalid_preferences"}), 400
    user = current_user()
    key = _claim(user["id"], "looks")
    if not key:
        return _busy()
    try:
        prefs = personalization.resolved_preferences(user, overrides)
        docs = latest_results(user)
        palette = styling.palette_colors(docs.get("color_analysis"))
        wanted = {str(h).upper() for h in data.get("colors", []) if isinstance(h, str)} if isinstance(data.get("colors"), list) else set()
        colors = [c for c in palette if c["hex"] in wanted] or palette
        shape = (docs.get("body_shape") or {}).get("result")
        pool = look_pool(prefs, occasion, comfort, category)
        items_by_id = {item["id"]: item for item in pool}
        label = styling.CATALOG["occasion_labels"][occasion]
        prompt = looks_prompt(describe(docs, prefs), pool, colors, label, shape)
        try:
            def call(provider, model, timeout):
                return normalize_looks(color_providers.PROVIDERS[provider]["call"](model, None, None, prompt, timeout), set(items_by_id), {c["hex"] for c in colors})

            def compute():
                result, provider, model, _ = color_providers.run_chain(call, config.AI_TEXT_MAX_SECONDS, label="Occasion looks", text=True)
                logger.info("Occasion looks generated provider=%s model=%s", provider, model)
                return result

            looks, _ = ai_cache.cached_call("looks", user["id"], prompt, compute)
            source, notice = "ai", "Created by your AI stylist from your saved results."
        except ProviderError as provider_error:
            logger.warning("Occasion looks fell back to rules outcome=%s", provider_error.kind)
            looks, source = rule_looks(pool, shape, colors, catalog_items=[item for item in styling.CATALOG["body_items"] if styling._in_catalog(item, prefs["catalog"])], occasion=occasion), "rules"
            notice = "Your AI stylist is unavailable right now, so these looks were put together by our styling rules from your saved results. Try again later for AI-written looks."
    finally:
        _release(key, "looks")
    return jsonify({
        "looks": [_public_look(look, items_by_id, occasion) for look in looks], "source": source, "notice": notice,
        "catalog": prefs["catalog"], "palette_used": bool(colors), "shape_used": shape,
        **({"budget_note": "Budget filtering isn't available: MatchMyTone doesn't store prices, so we don't guess them."} if data.get("budget") else {}),
    })
