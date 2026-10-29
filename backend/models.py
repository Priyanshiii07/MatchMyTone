"""MongoDB collection helpers for MatchMyTone."""

from datetime import datetime, timezone
from uuid import uuid4

from pymongo import ASCENDING, DESCENDING, MongoClient

from config import AI_CACHE_HOURS, MONGODB_DB, MONGODB_URI

client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
db = client[MONGODB_DB]
users = db["users"]
user_profiles = db["user_profiles"]
analysis_collections = {
    "skincare": db["skincare_analysis_results"],
    "body_shape": db["body_analysis_results"],
    "face_shape": db["face_analysis_results"],
    "color_analysis": db["color_analysis_results"],
}
style_favorites = db["style_favorites"]
trend_cache = db["trend_cache"]
ai_cache = db["ai_cache"]
email_verifications = db["email_verification_tokens"]
password_resets = db["password_reset_tokens"]
# Recent registration / verification-email attempts, keyed by hashed email or client address (no raw emails or IPs).
rate_events = db["rate_limit_events"]


def utc_now():
    return datetime.now(timezone.utc)


def new_id():
    return uuid4().hex


def initialize_database():
    """Create required indexes without deleting or changing existing documents."""
    # Older deployments indexed plaintext token fields. Keep their documents,
    # but remove only those obsolete indexes so hash-only records can coexist.
    for collection, legacy_name in ((email_verifications, "verification_token_unique"), (password_resets, "reset_token_unique")):
        try:
            collection.drop_index(legacy_name)
        except Exception:
            pass
    users.create_index([("email", ASCENDING)], unique=True, name="users_email_unique")
    users.create_index([("name", ASCENDING)], unique=True, name="users_name_unique")
    users.create_index([("phone", ASCENDING)], unique=True, sparse=True, name="users_phone_unique")
    user_profiles.create_index([("user_id", ASCENDING)], unique=True, name="profiles_user_unique")
    for collection in analysis_collections.values():
        collection.create_index([("user_id", ASCENDING), ("created_at", DESCENDING)], name="user_created_desc")
        collection.create_index([("user_id", ASCENDING), ("request_id", ASCENDING)], unique=True, partialFilterExpression={"request_id": {"$exists": True}}, name="user_request_unique")
    trend_cache.create_index([("key", ASCENDING)], unique=True, name="trend_key_unique")
    ai_cache.create_index([("key", ASCENDING)], unique=True, name="ai_cache_key_unique")
    ai_cache.create_index([("created_at", ASCENDING)], expireAfterSeconds=AI_CACHE_HOURS * 3600, name="ai_cache_expiry")
    style_favorites.create_index([("user_id", ASCENDING), ("item_id", ASCENDING)], unique=True, name="favorite_user_item_unique")
    email_verifications.create_index([("token_hash", ASCENDING)], unique=True, partialFilterExpression={"token_hash": {"$exists": True}}, name="verification_token_hash_unique")
    email_verifications.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0, name="verification_expiry")
    password_resets.create_index([("token_hash", ASCENDING)], unique=True, partialFilterExpression={"token_hash": {"$exists": True}}, name="reset_token_hash_unique")
    password_resets.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0, name="reset_expiry")
    email_verifications.create_index([("user_id", ASCENDING), ("used", ASCENDING)], name="verification_user_used")
    rate_events.create_index([("key", ASCENDING), ("created_at", ASCENDING)], name="rate_key_time")
    rate_events.create_index([("expires_at", ASCENDING)], expireAfterSeconds=0, name="rate_expiry")


def ping():
    return client.admin.command("ping")
