// Route segment (used in /results/<type>/<id> and API paths) for each saved-results collection.
export const RESULT_ROUTES = { color_analysis: "color", skincare: "skincare", face_shape: "face-shape", body_shape: "body-shape" };
export const ROUTE_KINDS = { color: "color", "color-analysis": "color", skincare: "skincare", "face-shape": "face", "body-shape": "body" };

// Saved documents use snake_case and may predate the current schema; camelCase fallbacks cover older records.
export function colorDocumentToView(doc = {}) {
  return {
    seasonType: doc.season_type || doc.seasonType || "", seasonDescription: doc.season_description || doc.seasonDescription || "",
    undertone: doc.undertone || "", undertoneDescription: doc.undertone_description || doc.undertoneDescription || "",
    skinAge: doc.skin_age ?? doc.skinAge ?? null, skinAgeDescription: doc.skin_age_description || doc.skinAgeDescription || "",
    colorsToWear: doc.colors_to_wear || doc.colorsToWear || [], colorsToAvoid: doc.colors_to_avoid || doc.colorsToAvoid || [],
  };
}

/**
 * Whether a saved document carries the recommendations its page needs. An outdated or failing API can
 * save a result without them; the page must then offer recovery instead of a success message.
 */
export function hasRecommendations(kind, doc) {
  if (!doc?.id) return false;
  if (kind === "skincare") return Boolean(doc.plan && Array.isArray(doc.plan.morning) && doc.plan.morning.length);
  const styling = doc.styling;
  if (!styling) return false;
  if (kind === "color") return Array.isArray(styling.outfits);
  if (kind === "face") return Array.isArray(styling.hair) && styling.hair.length > 0;
  return Array.isArray(styling.items) && styling.items.length > 0;
}

/** Short headline for a saved result card. */
export function resultLabel(kind, doc = {}) {
  if (kind === "color_analysis") return doc.season_type || doc.seasonType || "Color profile";
  return doc.result || "Saved analysis";
}
