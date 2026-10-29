"""Authentication helpers shared by the API modules."""

from functools import wraps

from flask import jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

import config
from models import users


def current_user():
    return users.find_one({"id": get_jwt_identity()})


def require_user(fn):
    @wraps(fn)
    @jwt_required()
    def wrapped(*args, **kwargs):
        user = current_user()
        if not user:
            return jsonify({"error": "User account not found."}), 401
        # A token issued before verification became mandatory must not unlock anything for an unverified account.
        if config.REQUIRE_EMAIL_VERIFICATION and not user.get("is_verified"):
            return jsonify({"error": "Please verify your email before logging in.", "errorCode": "email_not_verified", "requires_verification": True}), 403
        return fn(*args, **kwargs)
    return wrapped


def client_ip():
    """Best-effort client address for rate limiting.

    The website calls the API from its server and forwards the visitor's X-Forwarded-For (set by the hosting
    edge), so the first entry is the visitor. A direct caller could forge it, which is why every limit that
    matters is also applied per email address.
    """
    forwarded = (request.headers.get("X-Forwarded-For") or "").split(",")[0].strip()
    return forwarded[:64] or (request.remote_addr or "unknown")
