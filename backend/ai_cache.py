"""Short-lived cache of validated AI text answers, so identical requests don't spend free-tier quota.

Keys combine the feature, the user and the exact prompt (which already contains the user's saved
context and question), so one user's answer can never be served to another. Entries expire through
a MongoDB TTL index after AI_CACHE_HOURS. Only validated results are stored; failures never are.
"""

import hashlib
import logging

from pymongo.errors import PyMongoError

from models import ai_cache, utc_now

logger = logging.getLogger("matchmytone.ai_cache")


def _key(feature, user_id, prompt):
    return hashlib.sha256(f"{feature}\n{user_id}\n{prompt}".encode("utf-8")).hexdigest()


def cached_call(feature, user_id, prompt, compute):
    """Return (value, cached). ``compute()`` runs only on a cache miss and must return a validated value."""
    key = _key(feature, user_id, prompt)
    try:
        hit = ai_cache.find_one({"key": key}, {"_id": 0, "value": 1})
    except PyMongoError:
        hit = None
    if hit:
        return hit["value"], True
    value = compute()
    try:
        ai_cache.update_one({"key": key}, {"$set": {"key": key, "feature": feature, "user_id": user_id, "value": value, "created_at": utc_now()}}, upsert=True)
    except PyMongoError as error:
        logger.warning("AI cache write skipped feature=%s error=%s", feature, type(error).__name__)
    return value, False
