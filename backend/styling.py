"""Deterministic styling recommendations for the body, face and color modules.

Every function takes an analysis result plus *resolved* preferences (see ``preferences.resolve``)
and returns a JSON-serialisable snapshot that is stored on the saved result, so a result keeps
the recommendations it was generated with even after the catalog or the user's preferences change.
Nothing here calls an AI provider or alters the underlying analysis.
"""

import colorsys
import json
import re
from pathlib import Path

CATALOG = json.loads(Path(__file__).with_name("style_catalog.json").read_text(encoding="utf-8"))
VERSION = CATALOG["version"]
HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")
SHAPES = ("Hourglass", "Rectangle", "Pear", "Apple", "Inverted Triangle")
FACE_SHAPES = ("Oval", "Round", "Square", "Heart", "Diamond")
ITEMS_PER_CATEGORY = 3


# ---------- palette helpers ----------

def palette_colors(color_doc):
    """Valid recommended colors from a saved color-analysis document (old or new field names)."""
    colors = (color_doc or {}).get("colors_to_wear") or (color_doc or {}).get("colorsToWear") or []
    return [{"name": str(c.get("name") or c["hex"]), "hex": c["hex"].upper()} for c in colors if isinstance(c, dict) and HEX.match(str(c.get("hex", "")))]


def _hls(hex_value):
    red, green, blue = (int(hex_value[i:i + 2], 16) / 255 for i in (1, 3, 5))
    _, lightness, saturation = colorsys.rgb_to_hls(red, green, blue)
    return lightness, saturation


ROLE_KEYS = {
    "light": lambda c: -_hls(c["hex"])[0],
    "dark": lambda c: _hls(c["hex"])[0],
    "neutral": lambda c: _hls(c["hex"])[1],
    "accent": lambda c: -_hls(c["hex"])[1],
}


def pick(palette, role, used=(), count=1):
    """The best palette colors for a garment role, preferring ones not already used in the outfit."""
    if not palette:
        return []
    ranked = sorted(palette, key=ROLE_KEYS.get(role, ROLE_KEYS["neutral"]))
    fresh = [color for color in ranked if color["hex"] not in used]
    return (fresh + [color for color in ranked if color["hex"] in used])[:count]


def palette_snapshot(color_doc):
    colors = palette_colors(color_doc)
    if not colors:
        return None
    return {"result_id": color_doc.get("id"), "season": color_doc.get("season_type") or color_doc.get("seasonType"), "colors": colors}


# ---------- shared selection ----------

def _in_catalog(item, catalog):
    return catalog in item["catalogs"]


def _snapshot(prefs, keys):
    base = {"catalog": prefs["catalog"], "catalog_source": prefs["catalog_source"]}
    return {**base, **{key: prefs[key] for key in keys if prefs.get(key) not in (None, [], "")}}


def _header(module, prefs, keys, palette):
    return {
        "module": module, "catalog_version": VERSION, "catalog": prefs["catalog"],
        "catalog_label": CATALOG["catalog_labels"][prefs["catalog"]], "catalog_source": prefs["catalog_source"],
        "needs_choice": prefs["needs_choice"], "preferences": _snapshot(prefs, keys), "palette": palette,
    }


def _card(item, why, reasons, colors):
    card = {"id": item["id"], "catalog": item["catalogs"][0], "title": item["title"], "why": why, "reasons": reasons, "tip": item.get("tip", ""), "art": item["art"], "colors": colors}
    if item.get("photo"):
        card["photo"] = item["photo"]
    return card


# ---------- body ----------

def _body_score(item, shape, prefs):
    score = 3 if shape in item.get("shapes", {}) else 0
    score += 2 * len(set(item.get("occasions", [])) & set(prefs["occasions"]))
    score += 2 if "traditional" in item.get("flags", []) and "traditional" in prefs["style_extras"] else 0
    return score


def _body_reasons(item, prefs):
    occasion_labels = CATALOG["occasion_labels"]
    return [f"Good for {occasion_labels[o].lower()}" for o in item.get("occasions", []) if o in prefs["occasions"]][:2]


def body_styling(shape, prefs, palette=None):
    """Clothing ideas for a body-shape result in the user's chosen catalog."""
    modest = "modest" in prefs["style_extras"]
    items = [item for item in CATALOG["body_items"] if _in_catalog(item, prefs["catalog"]) and not (modest and "revealing" in item.get("flags", []))]
    colors = (palette or {}).get("colors", [])
    cards, categories = [], []
    for category in CATALOG["body_categories"]:
        in_category = [item for item in items if item["category"] == category["id"]]
        if not in_category:
            continue
        ranked = sorted(in_category, key=lambda item: -_body_score(item, shape, prefs))
        categories.append({"id": category["id"], "label": category["label"]})
        for item in ranked[:ITEMS_PER_CATEGORY]:
            why = item.get("shapes", {}).get(shape) or item["desc"]
            cards.append({**_card(item, why, _body_reasons(item, prefs), pick(colors, item.get("role", "neutral"), count=2)), "category": category["id"], "occasions": item.get("occasions", []), "fits": item.get("fits", [])})
    notes_catalog = prefs["catalog"]
    return {
        **_header("body", prefs, ("occasions", "style_extras"), palette),
        "shape_label": CATALOG["shape_display_names"].get(notes_catalog, {}).get(shape, shape),
        "categories": categories, "items": cards,
        "shape_notes": CATALOG["body_shape_notes"][notes_catalog].get(shape, []),
        "fit_guide": CATALOG["body_fit_guides"][notes_catalog],
        "occasion_labels": CATALOG["occasion_labels"],
    }


# ---------- face ----------

def _hair_allowed(item, prefs):
    textures = item.get("textures") or []
    return not textures or prefs.get("hair_texture") in textures


def _rank(items, shape, prefs):
    # Shape match first; texture-specific cuts only reach this point when the user gave their texture, so they rank up.
    def key(item):
        return -(3 if shape in item.get("shapes", {}) else 0) - (2 if item.get("textures") else 0)
    return sorted(items, key=key)


def _face_card(item, shape):
    reasons = ["Suits the hair texture you told us"] if item.get("textures") else []
    if item.get("maintenance"):
        reasons.append(f"{item['maintenance'].capitalize()} upkeep")
    extra = {key: item[key] for key in ("lengths", "maintenance", "textures") if item.get(key)}
    return {**_card(item, item.get("shapes", {}).get(shape) or item["desc"], reasons, []), "group": item["group"], **extra}


def _face_group(name, shape, prefs, count):
    items = [item for item in CATALOG["face_items"] if item["group"] == name and _in_catalog(item, prefs["catalog"])]
    return [_face_card(item, shape) for item in _rank(items, shape, prefs)[:count]]


def _hair_section(shape, prefs):
    hair = [item for item in CATALOG["face_items"] if item["group"] == "hair" and _in_catalog(item, prefs["catalog"]) and _hair_allowed(item, prefs)]
    ranked = _rank(hair, shape, prefs)
    length = prefs.get("hair_length")
    if length in {"short", "medium", "long"}:
        preferred = [item for item in ranked if length in item.get("lengths", [])]
        others = [item for item in ranked if length not in item.get("lengths", [])]
    else:
        preferred, others = ranked, []
    return [_face_card(item, shape) for item in preferred[:4]], [_face_card(item, shape) for item in (preferred[4:] + others)[:3]]


def _makeup(prefs, palette):
    if prefs.get("makeup") != "yes":
        return None
    colors = (palette or {}).get("colors", [])
    if not colors:
        return {"available": False}
    used, ideas = set(), []
    for area, role in (("Lips", "accent"), ("Cheeks", "light"), ("Eyes", "neutral"), ("Liner", "dark")):
        chosen = pick(colors, role, used)
        used.update(color["hex"] for color in chosen)
        ideas.append({"area": area, "colors": chosen})
    return {"available": True, "ideas": ideas}


def face_styling(shape, prefs, palette=None):
    """Hair, eyewear and accessory ideas for a face-shape result."""
    recommended, alternatives = _hair_section(shape, prefs)
    return {
        **_header("face", prefs, ("hair_length", "hair_texture", "makeup"), palette),
        "hair": recommended, "hair_alternatives": alternatives,
        "texture_known": prefs.get("hair_texture") in {"straight", "wavy", "curly", "coily"},
        "eyewear": _face_group("eyewear", shape, prefs, 4), "accessories": _face_group("accessories", shape, prefs, 4),
        "grooming": CATALOG["grooming"][prefs["catalog"]],
        "makeup": _makeup(prefs, palette),
    }


# ---------- color ----------

def _outfits(catalog, palette):
    outfits = []
    for template in CATALOG["color_outfits"][catalog]:
        used, pieces = set(), []
        for piece, role in template["pieces"]:
            color = pick(palette, role, used)[0]
            used.add(color["hex"])
            pieces.append({"piece": piece, "name": color["name"], "hex": color["hex"]})
        outfits.append({"id": f"{catalog}-{template['id']}", "catalog": catalog, "title": template["title"], "occasion": template["occasion"], "pieces": pieces})
    return outfits


def color_styling(color_doc, prefs):
    """How to wear an existing palette. The palette itself (season, undertone, colors) is never changed."""
    palette = palette_colors(color_doc)
    catalog = prefs["catalog"]
    outfits = _outfits(catalog, palette) if palette else []
    if prefs["occasions"]:
        outfits.sort(key=lambda outfit: outfit["occasion"] not in prefs["occasions"])
    undertone = str(color_doc.get("undertone") or "").capitalize()
    accessories = CATALOG["undertone_accessories"].get(undertone)
    notes_catalog = catalog
    avoid = [c for c in (color_doc.get("colors_to_avoid") or color_doc.get("colorsToAvoid") or []) if isinstance(c, dict) and HEX.match(str(c.get("hex", "")))]
    return {
        **_header("color", prefs, ("occasions",), None),
        "outfits": outfits,
        "accessories": {**accessories, "labels": CATALOG["accessory_labels"][notes_catalog]} if accessories else None,
        "avoid": {"colors": [{"name": str(c.get("name") or c["hex"]), "hex": c["hex"].upper()} for c in avoid], "guidance": CATALOG["avoid_guidance"][notes_catalog]} if avoid else None,
        "occasion_labels": CATALOG["occasion_labels"],
    }


# ---------- photos ----------

PHOTOS = {item["id"]: item["photo"] for item in CATALOG["body_items"] + CATALOG["face_items"] if item.get("photo")}
CARD_LISTS = ("items", "hair", "hair_alternatives", "eyewear", "accessories")


def with_current_photos(snapshot):
    """Copy of a saved styling snapshot whose cards use the catalog's current photos.

    Only the image changes; which items were recommended, and why, stays exactly as saved.
    """
    if not isinstance(snapshot, dict):
        return snapshot
    refreshed = dict(snapshot)
    for key in CARD_LISTS:
        if isinstance(snapshot.get(key), list):
            refreshed[key] = [{**card, "photo": PHOTOS[card["id"]]} if isinstance(card, dict) and card.get("id") in PHOTOS else card for card in snapshot[key]]
    return refreshed


# ---------- questionnaire confidence ----------

def shape_confidence(answers, result):
    """How strongly the questionnaire answers point to ``result``; never invents measurements."""
    scores = {}
    for answer in (answers or {}).values():
        for shape in (answer.get("shapes") if isinstance(answer, dict) else None) or []:
            if isinstance(shape, str):
                scores[shape] = scores.get(shape, 0) + 1
    top = scores.get(result, 0)
    runner_up = max((score for shape, score in scores.items() if shape != result), default=0)
    margin = top - runner_up
    level = "clear" if margin >= 2 else "leaning" if margin == 1 else "mixed"
    alternatives = [shape for shape, score in sorted(scores.items(), key=lambda pair: -pair[1]) if shape != result and score >= top - 1][:2]
    return {"level": level, "alternatives": alternatives, "answered": len(answers or {})}


def build_styling(kind, doc, prefs, palette=None):
    if kind == "body_shape":
        return body_styling(doc.get("result"), prefs, palette)
    if kind == "face_shape":
        return face_styling(doc.get("result"), prefs, palette)
    if kind == "color_analysis":
        return color_styling(doc, prefs)
    raise ValueError(f"No styling for {kind}")
