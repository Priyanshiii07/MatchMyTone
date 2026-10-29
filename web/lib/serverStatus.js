// The web app needs API version 2 (saved recommendation snapshots). An older backend process still
// running on the same port saves results without them; this lets pages explain that instead of guessing.
export const REQUIRED_API_VERSION = 2;

export async function backendIsOutdated() {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    if (!response.ok) return false;
    const data = await response.json();
    return !(Number(data.api_version) >= REQUIRED_API_VERSION);
  } catch {
    return false;
  }
}

export const OUTDATED_MESSAGE = "The MatchMyTone server answering this page is an older version that can't build recommendations. Stop every old backend process, start the backend again, then press Try again.";
