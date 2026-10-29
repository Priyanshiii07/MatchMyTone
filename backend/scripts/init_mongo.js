// Run with mongosh:
// mongosh "mongodb://127.0.0.1:27017/matchmytone" backend/scripts/init_mongo.js
// This script is repeat-safe and never drops collections or documents.

const required = [
  "users", "user_profiles", "color_analysis_results", "skincare_analysis_results",
  "face_analysis_results", "body_analysis_results", "email_verification_tokens", "password_reset_tokens"
];
try { db.email_verification_tokens.dropIndex("verification_token_unique"); } catch (error) { }
try { db.password_reset_tokens.dropIndex("reset_token_unique"); } catch (error) { }

for (const name of required) {
  if (!db.getCollectionNames().includes(name)) db.createCollection(name);
}

db.users.createIndex({ email: 1 }, { unique: true, name: "users_email_unique" });
db.users.createIndex({ name: 1 }, { unique: true, name: "users_name_unique" });
db.users.createIndex({ phone: 1 }, { unique: true, sparse: true, name: "users_phone_unique" });
db.user_profiles.createIndex({ user_id: 1 }, { unique: true, name: "profiles_user_unique" });
for (const name of ["color_analysis_results", "skincare_analysis_results", "face_analysis_results", "body_analysis_results"]) {
  db.getCollection(name).createIndex({ user_id: 1, created_at: -1 }, { name: "user_created_desc" });
}
db.email_verification_tokens.createIndex({ token_hash: 1 }, { unique: true, partialFilterExpression: { token_hash: { $exists: true } }, name: "verification_token_hash_unique" });
db.email_verification_tokens.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0, name: "verification_expiry" });
db.password_reset_tokens.createIndex({ token_hash: 1 }, { unique: true, partialFilterExpression: { token_hash: { $exists: true } }, name: "reset_token_hash_unique" });
db.password_reset_tokens.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0, name: "reset_expiry" });

print(`MongoDB initialized: ${db.getName()}`);
printjson(db.getCollectionNames().filter((name) => required.includes(name)).sort());
