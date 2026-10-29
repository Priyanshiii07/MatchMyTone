"""Style preferences, per-result styling snapshots and saved favorites."""

import logging

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

import preferences
import skincare
import styling
from auth_helpers import current_user, require_user
from models import analysis_collections, user_profiles, utc_now

logger = logging.getLogger("matchmytone.personalization")
bp = Blueprint("personalization", __name__)
STYLED_KINDS = {"body_shape", "face_shape", "color_analysis"}
ROUTE_KINDS = {"body-shape": "body_shape", "face-shape": "face_shape", "color": "color_analysis", "color-analysis": "color_analysis"}
STYLING_HISTORY_LIMIT = 5


def stored_preferences(user_id):
    profile = user_profiles.find_one({"user_id": user_id}, {"_id": 0, "style_preferences": 1, "gender": 1}) or {}
    return profile.get("style_preferences") or {}, profile.get("gender")


def resolved_preferences(user, overrides=None):
    """Stored preferences with per-request overrides applied, resolved against the profile gender."""
    stored, gender = stored_preferences(user["id"])
    return preferences.resolve(preferences.merge(stored, overrides), gender or user.get("gender"))


def latest_palette(user_id):
    doc = analysis_collections["color_analysis"].find_one({"user_id": user_id, "is_face": True}, {"_id": 0}, sort=[("created_at", -1)])
    return styling.palette_snapshot(doc) if doc else None


def new_styling(kind, doc, user, overrides=None):
    """Snapshot to store on a newly saved result."""
    prefs = resolved_preferences(user, overrides)
    palette = None if kind == "color_analysis" else latest_palette(user["id"])
    return styling.build_styling(kind, doc, prefs, palette)


def attach_styling(kind, doc, user):
    """Add recommendations to a result for display. Saved snapshots are returned unchanged.

    Results saved before personalised styling existed get recommendations from the user's current
    preferences, flagged ``provisional`` so the page can say so; nothing is written back.
    """
    if kind in STYLED_KINDS and not isinstance(doc.get("styling"), dict):
        doc = {**doc, "styling": {**new_styling(kind, doc, user), "provisional": True}}
    elif kind in {"body_shape", "face_shape"}:
        doc = {**doc, "styling": styling.with_current_photos(doc["styling"])}
    if kind in {"body_shape", "face_shape"} and "confidence" not in doc and isinstance(doc.get("answers"), dict):
        doc = {**doc, "confidence": styling.shape_confidence(doc["answers"], doc.get("result"))}
    if kind == "skincare" and not isinstance(doc.get("plan"), dict) and isinstance(doc.get("answers"), dict):
        # The routine is a pure function of the saved answers, so a missing one is rebuilt and saved
        # (only if still missing, so no other field and no newer plan is ever overwritten).
        plan = skincare.skincare_plan(doc["answers"], doc.get("routine_extras") or [])
        analysis_collections["skincare"].update_one({"id": doc["id"], "user_id": user["id"], "plan": {"$exists": False}}, {"$set": {"plan": plan, "updated_at": utc_now()}})
        doc = {**doc, "plan": plan}
    return doc


def request_overrides(data):
    """Validated per-request preference overrides (``styling_preferences`` in the JSON body)."""
    raw = data.get("styling_preferences")
    if raw in (None, {}):
        return {}, None
    return preferences.validate_preferences(raw)


@bp.get("/api/users/preferences")
@require_user
def get_preferences():
    stored, gender = stored_preferences(get_jwt_identity())
    return jsonify({"preferences": stored, "resolved": preferences.resolve(stored, gender)})


@bp.put("/api/users/preferences")
@require_user
def update_preferences():
    data = request.get_json(silent=True)
    clean, error = preferences.validate_preferences(data if isinstance(data, dict) else None)
    if error:
        return jsonify({"error": error, "errorCode": "invalid_preferences"}), 400
    user_id = get_jwt_identity()
    stored, gender = stored_preferences(user_id)
    merged = preferences.merge(stored, clean)
    now = utc_now()
    user_profiles.update_one({"user_id": user_id}, {"$set": {"style_preferences": merged, "updated_at": now}, "$setOnInsert": {"user_id": user_id, "created_at": now}}, upsert=True)
    logger.info("Style preferences updated fields=%s", sorted(clean))
    return jsonify({"message": "Your style preferences were saved.", "preferences": merged, "resolved": preferences.resolve(merged, gender)})


@bp.put("/api/quiz/<quiz_type>/<result_id>/styling")
@require_user
def restyle_result(quiz_type, result_id):
    """Regenerate only the styling snapshot of one saved result; the analysis itself is untouched."""
    kind = ROUTE_KINDS.get(quiz_type)
    if kind not in STYLED_KINDS:
        return jsonify({"error": "This analysis has no styling catalog.", "errorCode": "invalid_type"}), 400
    data = request.get_json(silent=True) or {}
    overrides, error = preferences.validate_preferences(data.get("preferences") or {})
    if error:
        return jsonify({"error": error, "errorCode": "invalid_preferences"}), 400
    user = current_user()
    collection = analysis_collections[kind]
    doc = collection.find_one({"id": result_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        return jsonify({"error": "Result not found.", "errorCode": "not_found"}), 404
    snapshot = new_styling(kind, doc, user, overrides)
    update = {"$set": {"styling": snapshot, "updated_at": utc_now()}}
    if isinstance(doc.get("styling"), dict):
        # Earlier versions stay revisitable; only the newest few are kept.
        update["$push"] = {"styling_history": {"$each": [{**doc["styling"], "replaced_at": utc_now()}], "$slice": -STYLING_HISTORY_LIMIT}}
    collection.update_one({"id": result_id, "user_id": user["id"]}, update)
    return jsonify({"result": {**doc, "styling": snapshot}})
