import { NextResponse } from "next/server";
import { API_BASE } from "../../../../lib/auth";

// Keep the cookie no longer than the backend token itself is valid.
function tokenLifetimeSeconds(token) {
  try {
    const { exp } = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    return Math.max(60, Math.floor(exp - Date.now() / 1000));
  } catch { return 60 * 60; }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const upstream = await fetch(`${API_BASE}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
    const data = await upstream.json().catch(() => ({ error: "Invalid server response" }));
    if (!upstream.ok) return NextResponse.json(data, { status: upstream.status });
    const token = data?.user?.token || data?.token;
    if (!token) return NextResponse.json({ error: "Login response did not contain a session token." }, { status: 502 });
    const response = NextResponse.json({ message: data.message, user: { ...data.user, token: undefined } });
    response.cookies.set("matchmytone_access", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: tokenLifetimeSeconds(token) });
    return response;
  } catch (error) {
    console.error(`MatchMyTone API unreachable at ${new URL(API_BASE).host}: ${error?.cause?.code || error?.name || "fetch failed"}`);
    return NextResponse.json({ error: "The account service is unavailable right now. Please try again shortly." }, { status: 503 });
  }
}
