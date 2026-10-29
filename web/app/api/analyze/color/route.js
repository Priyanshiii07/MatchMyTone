import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE } from "../../../../lib/auth";

// On Vercel, let the selfie analysis run for up to 60 s; the API keeps its AI time budget below that
// (COLOR_ANALYSIS_MAX_SECONDS / AI_TEXT_MAX_SECONDS on Render).
export const maxDuration = 60;

export async function POST(request) {
  const token = (await cookies()).get("matchmytone_access")?.value;
  if (!token) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    const upstream = await fetch(`${API_BASE}/analyze/color`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(await request.json()), cache: "no-store" });
    const data = await upstream.json().catch(() => ({ error: "The analysis service returned an invalid response." }));
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ error: "The analysis service could not be reached." }, { status: 502 });
  }
}
