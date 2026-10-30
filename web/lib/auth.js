import { cookies } from "next/headers";

/**
 * Where this server reaches the Flask API, normalised so small typos in the hosting dashboard don't break login:
 * surrounding spaces/quotes are removed, a missing https:// is added, and the URL always ends in /api.
 */
export function normalizeApiBase(value) {
  let base = String(value || "").trim().replace(/^["']|["']$/g, "").trim();
  if (!base) return "";
  if (!/^https?:\/\//i.test(base)) base = `${/^(localhost|127\.0\.0\.1)(:|\/|$)/.test(base) ? "http" : "https"}://${base}`;
  base = base.replace(/\/+$/, "");
  return /\/api$/i.test(base) ? base : `${base}/api`;
}

const configuredBase = normalizeApiBase(process.env.MATCHMYTONE_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL);
if (!configuredBase && process.env.NODE_ENV === "production") {
  // Shows in the hosting logs (e.g. Vercel → Logs); without it every API call fails with "service unavailable".
  console.error("MATCHMYTONE_API_BASE_URL is not set: set it to https://<your-api>.onrender.com/api and redeploy.");
}
export const API_BASE = configuredBase || "http://127.0.0.1:5000/api";

export async function getSession() {
  const token = (await cookies()).get("matchmytone_access")?.value;
  if (!token) return null;
  try {
    const response = await fetch(`${API_BASE}/users/profile`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    return data.user || null;
  } catch { return null; }
}

/** Server-side GET to the Flask API as the signed-in user; returns parsed JSON or null on any failure. */
export async function apiGetWithSession(path) {
  const token = (await cookies()).get("matchmytone_access")?.value;
  if (!token) return null;
  try {
    const response = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    return response.ok ? await response.json() : null;
  } catch { return null; }
}

