// Run with mongosh:
// mongosh "mongodb://127.0.0.1:27017/matchmytone" backend/scripts/verify_mongo.js

const required = [
  "users", "user_profiles", "color_analysis_results", "skincare_analysis_results",
  "face_analysis_results", "body_analysis_results", "email_verification_tokens", "password_reset_tokens"
];
const missingCollections = required.filter((name) => !db.getCollectionNames().includes(name));
const expected = {
  users: ["users_email_unique", "users_name_unique", "users_phone_unique"],
  user_profiles: ["profiles_user_unique"],
  color_analysis_results: ["user_created_desc"],
  skincare_analysis_results: ["user_created_desc"],
  face_analysis_results: ["user_created_desc"],
  body_analysis_results: ["user_created_desc"],
  email_verification_tokens: ["verification_token_hash_unique", "verification_expiry"],
  password_reset_tokens: ["reset_token_hash_unique", "reset_expiry"]
};
const missingIndexes = [];
for (const [collection, names] of Object.entries(expected)) {
  const actual = db.getCollection(collection).getIndexes().map((index) => index.name);
  for (const name of names) if (!actual.includes(name)) missingIndexes.push(`${collection}.${name}`);
}
db.runCommand({ ping: 1 });
printjson({ database: db.getName(), missingCollections, missingIndexes, ok: missingCollections.length === 0 && missingIndexes.length === 0 });
if (missingCollections.length || missingIndexes.length) quit(1);
