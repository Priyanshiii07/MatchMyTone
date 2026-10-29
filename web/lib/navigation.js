// In-app navigation history kept in sessionStorage so the Back button only ever
// returns to a MatchMyTone page this tab actually visited.

export const NAV_STORAGE_KEY = "matchmytone-nav-history";
const MAX_ENTRIES = 30;
const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];
const PUBLIC_PAGES = ["/", "/about", ...AUTH_PAGES];

function pathOnly(path) {
  return String(path || "").split(/[?#]/)[0];
}

export function isInternalPath(path) {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\");
}

export function isAuthPage(path) {
  return AUTH_PAGES.includes(pathOnly(path));
}

export function isPublicPage(path) {
  return PUBLIC_PAGES.includes(pathOnly(path));
}

export function readHistory(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(NAV_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter(isInternalPath) : [];
  } catch {
    return [];
  }
}

// Record a page view. Returning to the previous entry (browser or in-app Back) pops instead of pushing.
export function recordVisit(history, path) {
  if (!isInternalPath(path)) return history;
  if (history[history.length - 1] === path) return history;
  if (history[history.length - 2] === path) return history.slice(0, -1);
  return [...history, path].slice(-MAX_ENTRIES);
}

// A previous page is a safe Back target only if it is an in-app page of the same "area":
// public pages (home, auth) go back to public pages; app pages never go back into the auth flow.
export function previousSafePath(history, currentPath, scope = "app") {
  const previous = history[history.length - 2];
  if (!isInternalPath(previous) || history[history.length - 1] !== currentPath) return null;
  if (pathOnly(previous) === pathOnly(currentPath)) return null;
  if (scope === "public") return isPublicPage(previous) ? previous : null;
  return isAuthPage(previous) ? null : previous;
}
