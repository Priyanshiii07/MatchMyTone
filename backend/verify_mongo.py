"""Verify MongoDB collections and named indexes without changing data."""

from models import analysis_collections, db, email_verifications, password_resets, ping, user_profiles, users


required = {
    "users": (users, {"users_email_unique", "users_name_unique", "users_phone_unique"}),
    "user_profiles": (user_profiles, {"profiles_user_unique"}),
    **{collection.name: (collection, {"user_created_desc"}) for collection in analysis_collections.values()},
    "email_verification_tokens": (email_verifications, {"verification_token_hash_unique", "verification_expiry"}),
    "password_reset_tokens": (password_resets, {"reset_token_hash_unique", "reset_expiry"}),
}


if __name__ == "__main__":
    ping()
    missing = []
    for name, (collection, expected_indexes) in required.items():
        if name not in db.list_collection_names():
            missing.append(f"collection:{name}")
            continue
        actual_indexes = set(collection.index_information())
        missing.extend(f"index:{name}.{index}" for index in expected_indexes - actual_indexes)
    if missing:
        raise SystemExit("Missing MongoDB requirements: " + ", ".join(sorted(missing)))
    print(f"MongoDB verification OK: {db.name}; {len(required)} required collections and indexes present.")
