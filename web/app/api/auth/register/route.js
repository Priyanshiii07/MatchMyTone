import { NextResponse } from "next/server";
import { API_BASE } from "../../../../lib/auth";

export async function POST(request) {
  try {
    // Pass the visitor's address (set by the hosting edge) so the API can rate-limit sign-ups per visitor.
    const forwarded = request.headers.get("x-forwarded-for");
    const headers = { "Content-Type": "application/json", ...(forwarded ? { "X-Forwarded-For": forwarded } : {}) };
    const upstream = await fetch(`${API_BASE}/auth/register`, { method: "POST", headers, body: JSON.stringify(await request.json()), cache: "no-store" });
    const data = await upstream.json().catch(() => ({ error: "Invalid server response" }));
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    console.error(`MatchMyTone API unreachable at ${new URL(API_BASE).host}: ${error?.cause?.code || error?.name || "fetch failed"}`);
    return NextResponse.json({ error: "The account service is unavailable right now. Please try again shortly." }, { status: 503 });
  }
}
