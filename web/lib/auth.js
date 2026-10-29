import { cookies } from "next/headers";

const API_BASE = (process.env.MATCHMYTONE_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5000/api").replace(/\/$/, "");

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

export { API_BASE };
