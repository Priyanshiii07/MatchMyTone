import { NextResponse } from "next/server";
import { API_BASE } from "../../../../lib/auth";

export async function POST() {
  try { await fetch(`${API_BASE}/auth/logout`, { method: "POST", cache: "no-store" }); } catch {}
  const response = NextResponse.json({ message: "Logged out successfully." });
  response.cookies.set("matchmytone_access", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
