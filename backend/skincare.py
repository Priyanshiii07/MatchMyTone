"""Skincare routine generation from questionnaire answers and optional routine extras.

Gender and styling preferences are deliberately not inputs: the routine depends only on what
the user reported about their skin and habits.
"""

import json
from pathlib import Path

DATA = json.loads(Path(__file__).with_name("skincare_catalog.json").read_text(encoding="utf-8"))
VERSION = DATA["version"]
SKIN_TYPE_NAMES = {"A": "Oily Skin", "B": "Dry Skin", "C": "Combination Skin", "D": "Normal Skin", "E": "Sensitive Skin"}
SKIN_TYPE_KEYS = {"Oily Skin": "oily", "Dry Skin": "dry", "Combination Skin": "combination", "Normal Skin": "normal", "Sensitive Skin": "sensitive"}
# Why each step sits where it does in the routine (shown beside the step).
STEP_ORDER = {
    "remove": "Makeup and sunscreen come off first so the cleanser can reach your skin.",
    "cleanse": "Clean skin first, so everything after it goes on evenly.",
    "hydrate": "Thin, watery layers go on before thicker creams.",
    "treat": "Treatments go on clean skin, before moisturiser. Use only one active at a time.",
    "moisturise": "Seals in water and supports your skin barrier.",
    "protect": "Always the last morning step, so nothing thins it out.",
}
SECTION_ORDER = (("shaving", "shaving"), ("razor_bumps", "razor_bumps"), ("beard", "beard"), ("workout", "workout"), ("outdoors", "outdoors"), ("makeup", "makeup"))


def _label(answer):
    return answer.get("label") if isinstance(answer, dict) else None


def determine_skin_type(answers):
    """Majority answer letter decides; ties resolve toward combination, oily, sensitive, dry, then normal.

    Mirrors ``web/lib/skincare.js`` so the saved result matches what the quiz showed.
    """
    counts = dict.fromkeys("ABCDE", 0)
    for answer in (answers or {}).values():
        if _label(answer) in counts:
            counts[_label(answer)] += 1
    top_score = max(counts.values())
    top = [key for key, value in counts.items() if value == top_score]
    if len(top) == 5 or ("A" in top and "B" in top) or "C" in top:
        return SKIN_TYPE_NAMES["C"]
    if len(top) == 1:
        return SKIN_TYPE_NAMES[top[0]]
    for letter in ("A", "E", "B"):
        if letter in top:
            return SKIN_TYPE_NAMES[letter]
    return SKIN_TYPE_NAMES["D"]


def concerns_for(answers):
    concerns = []
    for question, mapping in DATA["concern_map"].items():
        concerns += mapping.get(_label((answers or {}).get(question)) or "", [])
    return list(dict.fromkeys(concerns))


def _score(product, skin_key, concerns):
    return (3 if skin_key in product["skinTypes"] else 0) + 2 * sum(1 for concern in product["concerns"] if concern in concerns)


def _reason(product, skin_key, concerns):
    matched = [DATA["concern_labels"].get(c, c) for c in product["concerns"] if c in concerns]
    if matched:
        return f"Chosen for your {' and '.join(dict.fromkeys(matched))} focus."
    return f"A gentle general-purpose {product['category'].lower()} option for {skin_key} skin."


def _best(step, skin_key, concerns, exclude_active):
    candidates = [p for p in DATA["products"] if p["step"] == step and not (exclude_active and p.get("active"))]
    return max(candidates, key=lambda p: _score(p, skin_key, concerns), default=None)


def _alternatives(product, sensitive):
    """Other catalog products for the same step: real, link-verified options, never invented ones."""
    return [{"id": p["id"], "brand": p["brand"], "name": p["name"], "href": p["href"]} for p in DATA["products"]
            if p["step"] == product["step"] and p["id"] != product["id"] and not (sensitive and p.get("active"))]


def _public_product(product, skin_key, concerns, sensitive=False):
    keys = ("id", "brand", "name", "category", "step", "image", "href", "description", "caution", "ingredients")
    return {**{key: product[key] for key in keys}, "reason": _reason(product, skin_key, concerns), "alternatives": _alternatives(product, sensitive)}


def _step(step_id, label, product, generic):
    kind = step_id.split("-", 1)[1]
    return {"id": step_id, "label": label, "detail": f"{product['brand']} {product['name']}" if product else generic, "product_id": product["id"] if product else None, "why": STEP_ORDER.get(kind, "")}


def _routine(skin_key, concerns, extras, sensitive):
    cleanser = _best("cleanse", skin_key, concerns, sensitive)
    moisturiser = _best("moisturise", skin_key, concerns, sensitive)
    sunscreen = _best("protect", skin_key, concerns, sensitive)
    advanced = "advanced" in extras
    hydrator = _best("hydrate", skin_key, concerns, sensitive) if advanced else None
    wants_treatment = advanced and not sensitive and any(c in concerns for c in ("acne", "pores", "tone", "oily"))
    treatment = _best("treat", skin_key, concerns, sensitive) if wants_treatment else None
    morning = [_step("am-cleanse", "Cleanse gently", cleanser, "A mild, non-stripping cleanser")]
    if hydrator:
        morning.append(_step("am-hydrate", "Hydrate", hydrator, "A light hydrating layer on slightly damp skin"))
    morning += [_step("am-moisturise", "Moisturise", moisturiser, "A moisturiser suited to your skin type"), _step("am-protect", "Protect with sunscreen", sunscreen, "Broad-spectrum SPF 30+ every morning")]
    evening = []
    if "makeup" in extras:
        evening.append({"id": "pm-remove", "label": "Remove makeup or sunscreen", "detail": "Micellar water or a gentle cleansing balm", "product_id": None, "why": STEP_ORDER["remove"]})
    evening.append(_step("pm-cleanse", "Cleanse away the day", cleanser, "The same gentle cleanser"))
    if treatment:
        evening.append(_step("pm-treat", "Treat (one active only)", treatment, "One targeted serum, introduced slowly"))
    elif hydrator:
        evening.append(_step("pm-hydrate", "Hydrate", hydrator, "A hydrating serum"))
    evening.append(_step("pm-moisturise", "Moisturise", moisturiser, "A moisturiser to support your skin barrier overnight"))
    return morning, evening, [p for p in (cleanser, hydrator, treatment, moisturiser, sunscreen) if p]


def skincare_plan(answers, extras=()):
    """Morning/evening routine, optional care sections, products and cautions for one questionnaire."""
    extras = list(extras or [])
    skin_type = determine_skin_type(answers)
    skin_key = SKIN_TYPE_KEYS[skin_type]
    concerns = concerns_for(answers)
    sensitive = skin_key == "sensitive" or "sensitive" in concerns
    morning, evening, used = _routine(skin_key, concerns, extras, sensitive)
    sections = [{"id": section_id, **DATA["sections"][section_id]} for section_id, extra in SECTION_ORDER if extra in extras]
    cautions = [DATA["cautions"]["patch_test"], DATA["cautions"]["one_active"]]
    if sensitive:
        cautions.append(DATA["cautions"]["sensitive"])
    if _label((answers or {}).get("10")) in {"C", "D"}:
        cautions.append(DATA["cautions"]["many_products"])
    if "fragrance_free" in extras or sensitive:
        cautions.append(DATA["cautions"]["fragrance_free"])
    cautions.append(DATA["cautions"]["dermatologist"])
    return {
        "module": "skincare", "catalog_version": VERSION, "skin_type": skin_type,
        "concerns": [DATA["concern_labels"].get(c, c) for c in concerns if c not in {"normal", "combination"}],
        "level": "advanced" if "advanced" in extras else "simple", "extras": extras,
        "morning": morning, "evening": evening, "sections": sections,
        "products": [_public_product(p, skin_key, concerns, sensitive) for p in used], "cautions": cautions,
    }
