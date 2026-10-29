"""Style-preference model shared by every analysis module.

Preferences are voluntary and live in ``user_profiles.style_preferences``. They are kept
separate from the profile's gender and from anything an AI provider infers from a selfie:
AI output never writes to them.
"""

import json
from pathlib import Path

OPTIONS = json.loads(Path(__file__).with_name("preference_options.json").read_text(encoding="utf-8"))
FIELDS = OPTIONS["fields"]
# Every value ever offered (other features, such as the look generator's occasion and comfort lists, reuse these).
ALLOWED = {key: {option["value"] for option in spec["options"]} for key, spec in FIELDS.items()}
MULTI = {key for key, spec in FIELDS.items() if spec.get("multi")}
SKINCARE_EXTRAS = {option["value"] for option in OPTIONS["skincare_extras"]["options"]}
# Retired fields/options are no longer offered as preferences. Older records and clients may still send them:
# they are accepted without error, never stored, and ignored when recommendations are generated.
RETIRED_FIELDS = {key for key, spec in FIELDS.items() if spec.get("retired")}
ACTIVE = {key: {option["value"] for option in spec["options"] if not option.get("retired")} for key, spec in FIELDS.items() if key not in RETIRED_FIELDS}
CATALOGS = ("menswear", "womenswear", "unisex")
PROFILE_GENDER_CATALOG = {"male": "menswear", "female": "womenswear"}


def validate_preferences(data):
    """Return (clean_preferences, error). Unknown keys or values are rejected, never stored.

    ``None`` or an empty string/list clears a field. Retired fields are skipped; a retired single value
    (such as the old "mixed" catalog) clears the field, and retired values are dropped from lists.
    """
    if not isinstance(data, dict):
        return None, "Style preferences must be an object."
    clean = {}
    for key, value in data.items():
        if key not in FIELDS:
            return None, f"Unknown style preference '{key}'."
        if key in RETIRED_FIELDS:
            continue
        if value in (None, "", []):
            clean[key] = None
            continue
        if key in MULTI:
            if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
                return None, f"'{key}' must be a list of options."
            values = list(dict.fromkeys(value))
            if not set(values) <= ALLOWED[key]:
                return None, f"'{key}' contains an option we don't recognise."
            clean[key] = [item for item in values if item in ACTIVE[key]] or None
        else:
            if not isinstance(value, str) or value not in ALLOWED[key]:
                return None, f"'{key}' must be one of: {', '.join(sorted(ACTIVE[key]))}."
            clean[key] = value if value in ACTIVE[key] else None
    return clean, None


def merge(stored, updates):
    """Apply validated updates; a None value removes that field."""
    merged = dict(stored or {})
    for key, value in (updates or {}).items():
        if value is None:
            merged.pop(key, None)
        else:
            merged[key] = value
    return merged


def validate_skincare_extras(value):
    if value in (None, []):
        return [], None
    if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
        return None, "Routine extras must be a list of options."
    extras = list(dict.fromkeys(value))
    if not set(extras) <= SKINCARE_EXTRAS:
        return None, "Routine extras contain an option we don't recognise."
    return extras, None


def resolve(stored, gender=None):
    """Effective preferences for generating recommendations.

    Catalog precedence: the user's explicit choice, then the gender they chose on their
    profile, then a neutral unisex catalog flagged ``needs_choice`` so the UI asks them.
    A stored legacy "mixed" catalog follows the same fallback (profile gender, otherwise unisex);
    retired fields and options in older records are ignored.
    """
    prefs = {}
    for key, value in (stored or {}).items():
        if key not in ACTIVE or value in (None, "", []):
            continue
        if isinstance(value, list):
            value = [item for item in value if item in ACTIVE[key]]
            if value:
                prefs[key] = value
        elif value in ACTIVE[key]:
            prefs[key] = value
    if prefs.get("catalog") in CATALOGS:
        catalog, source = prefs["catalog"], "preference"
    elif str(gender or "").lower() in PROFILE_GENDER_CATALOG:
        catalog, source = PROFILE_GENDER_CATALOG[str(gender).lower()], "profile"
    else:
        catalog, source = "unisex", "default"
    return {
        **prefs,
        "catalog": catalog,
        "catalog_source": source,
        "needs_choice": source == "default",
        "occasions": prefs.get("occasions", []),
        "style_extras": prefs.get("style_extras", []),
    }
