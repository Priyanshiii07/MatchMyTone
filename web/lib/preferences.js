import OPTIONS from "./preference-options.json";

// Same file the Flask API validates against (backend/preference_options.json); a backend test keeps them identical.
export const PREFERENCE_FIELDS = OPTIONS.fields;
export const SKINCARE_EXTRAS = OPTIONS.skincare_extras;
export const CATALOG_CHOICES = OPTIONS.fields.catalog.options.filter((option) => !option.retired);

const SOURCE_TEXT = {
  preference: "your style preferences",
  profile: "the gender on your profile",
  default: "a neutral default",
};

/** True for a preference field and value the user can still choose (retired ones are kept only for old records). */
export function isActivePreference(field, value) {
  const spec = PREFERENCE_FIELDS[field];
  if (!spec || spec.retired) return false;
  const live = (item) => spec.options.some((option) => option.value === item && !option.retired);
  return Array.isArray(value) ? value.some(live) : live(value);
}

export function optionLabel(field, value) {
  return PREFERENCE_FIELDS[field]?.options.find((option) => option.value === value)?.label || "";
}

export function catalogLabel(catalog) {
  return optionLabel("catalog", catalog) || "Styling";
}

/** Plain-language reason a catalog is being shown, e.g. "Men's styling, based on the gender on your profile". */
export function catalogSourceText(styling) {
  if (!styling) return "";
  return `${catalogLabel(styling.catalog)}, based on ${SOURCE_TEXT[styling.catalog_source] || SOURCE_TEXT.default}`;
}

/** Drop empty values so a PUT never sends meaningless keys. */
export function compactPreferences(preferences = {}) {
  return Object.fromEntries(Object.entries(preferences).filter(([, value]) => value !== "" && value != null && !(Array.isArray(value) && !value.length)));
}

/** Group the skincare extras by their `group` label for display. */
export function groupedSkincareExtras() {
  return SKINCARE_EXTRAS.options.reduce((groups, option) => ({ ...groups, [option.group]: [...(groups[option.group] || []), option] }), {});
}
