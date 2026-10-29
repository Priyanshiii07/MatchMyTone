import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE } from "../../../../lib/auth";
async function forward(request, method) { const token = (await cookies()).get("matchmytone_access")?.value; if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 }); const body = method === "PUT" ? await request.json() : undefined; const upstream = await fetch(`${API_BASE}/users/profile`, { method, headers: { ...(body ? { "Content-Type": "application/json" } : {}), Authorization: `Bearer ${token}` }, ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store" }); const data = await upstream.json().catch(() => ({})); return NextResponse.json(data, { status: upstream.status }); }
export async function GET(request) { return forward(request, "GET"); }
export async function PUT(request) { return forward(request, "PUT"); }
