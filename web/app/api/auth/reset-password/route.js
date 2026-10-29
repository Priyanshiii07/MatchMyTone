import { NextResponse } from "next/server";
import { API_BASE } from "../../../../lib/auth";

export async function POST(request) {
  const upstream = await fetch(`${API_BASE}/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(await request.json()), cache: "no-store" });
  const data = await upstream.json().catch(() => ({ error: "Invalid server response" }));
  return NextResponse.json(data, { status: upstream.status });
}
