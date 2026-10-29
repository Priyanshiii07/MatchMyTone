"""Per-result AI explanations, grounded trend highlights and saved progress (checklists, favourite shades)."""

import logging
import re
import threading
import time

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity

import ai_insights
import personalization
import trends
from auth_helpers import current_user, require_user
from color_providers import ProviderError
from models import analysis_collections, utc_now

logger = logging.getLogger("matchmytone.ai_routes")
bp = Blueprint("ai_routes", __name__)
KINDS = {"body-shape": "body_shape", "face-shape": "face_shape", "color": "color_analysis", "color-analysis": "color_analysis", "skincare": "skincare"}
HEX = re.compile(r"^#[0-9A-Fa-f]{6}$")
ITEM_ID = re.compile(r"^[A-Za-z0-9_-]{1,80}$")
INSIGHT_COOLDOWN_SECONDS = 20
_active = set()
_recent = {}
_guard = threading.Lock()


def _owned(quiz_type):
    """(kind, doc) for a result owned by the signed-in user, with any missing recommendations repaired."""
    kind = KINDS.get(quiz_type)
    if not kind:
        return None, None
    doc = analysis_collections[kind].find_one({"id": request.view_args["result_id"], "user_id": get_jwt_identity()}, {"_id": 0})
    return kind, (personalization.attach_styling(kind, doc, current_user()) if doc else None)


def _provider_error_body(error):
    return {"error": "We couldn't write your personal notes just now. Your recommendations are still saved — please try again shortly.", "errorCode": f"provider_{error.kind}", "retryable": error.kind in {"temporary", "malformed", "timeout", "rate_limit"}}


@bp.post("/api/quiz/<quiz_type>/<result_id>/insights")
@require_user
def generate_insights(quiz_type, result_id):
    """Ask the AI to explain this result's existing recommendations and save the explanation."""
    kind, doc = _owned(quiz_type)
    if not kind:
        return jsonify({"error": "Invalid analysis type.", "errorCode": "invalid_type"}), 400
    if not doc:
        return jsonify({"error": "Result not found.", "errorCode": "not_found"}), 404
    key = (get_jwt_identity(), result_id)
    with _guard:
        if key in _active or time.monotonic() < _recent.get(key, 0):
            return jsonify({"error": "Your notes are already being written. Please wait a moment.", "errorCode": "insights_busy"}), 429
        _active.add(key)
    try:
        insights, provider, model = ai_insights.generate(kind, doc, get_jwt_identity())
    except ProviderError as error:
        logger.warning("Insights failed kind=%s outcome=%s", kind, error.kind)
        return jsonify(_provider_error_body(error)), 503
    except ValueError:
        return jsonify({"error": "There are no recommendations to explain for this result yet.", "errorCode": "insights_unavailable"}), 400
    finally:
        with _guard:
            _active.discard(key)
            _recent[key] = time.monotonic() + INSIGHT_COOLDOWN_SECONDS
    analysis_collections[kind].update_one({"id": result_id, "user_id": get_jwt_identity()}, {"$set": {"insights": insights, "updated_at": utc_now()}})
    logger.info("Insights saved kind=%s provider=%s model=%s notes=%d", kind, provider, model, len(insights["notes"]))
    return jsonify({"insights": {**insights, "generated_at": insights["generated_at"].isoformat()}})


@bp.get("/api/quiz/<quiz_type>/<result_id>/trends")
@require_user
def result_trends(quiz_type, result_id):
    kind, doc = _owned(quiz_type)
    if not kind:
        return jsonify({"error": "Invalid analysis type.", "errorCode": "invalid_type"}), 400
    if not doc:
        return jsonify({"error": "Result not found.", "errorCode": "not_found"}), 404
    return jsonify(trends.get_trends(kind, doc))


@bp.put("/api/quiz/<quiz_type>/<result_id>/progress")
@require_user
def save_progress(quiz_type, result_id):
    """Persist routine/checklist ticks and favourite shades on the user's own result."""
    kind = KINDS.get(quiz_type)
    if not kind:
        return jsonify({"error": "Invalid analysis type.", "errorCode": "invalid_type"}), 400
    data = request.get_json(silent=True) or {}
    updates = {}
    checklist = data.get("checklist")
    if checklist is not None:
        if not isinstance(checklist, dict) or len(checklist) > 60 or not all(ITEM_ID.match(str(k)) and isinstance(v, bool) for k, v in checklist.items()):
            return jsonify({"error": "Checklist progress is invalid.", "errorCode": "invalid_progress"}), 400
        updates.update({f"user_state.checklist.{k}": v for k, v in checklist.items()})
    shades = data.get("shades")
    if shades is not None:
        if kind != "color_analysis" or not isinstance(shades, list) or len(shades) > 12 or not all(isinstance(h, str) and HEX.match(h) for h in shades):
            return jsonify({"error": "Favourite shades are invalid.", "errorCode": "invalid_progress"}), 400
        updates["user_state.shades"] = list(dict.fromkeys(h.upper() for h in shades))
    if not updates:
        return jsonify({"error": "Nothing to save.", "errorCode": "invalid_progress"}), 400
    updated = analysis_collections[kind].find_one_and_update({"id": result_id, "user_id": get_jwt_identity()}, {"$set": {**updates, "updated_at": utc_now()}}, projection={"_id": 0, "user_state": 1}, return_document=True)
    if not updated:
        return jsonify({"error": "Result not found.", "errorCode": "not_found"}), 404
    return jsonify({"user_state": updated.get("user_state", {})})
