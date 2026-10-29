import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE } from "../../../../lib/auth";
export async function GET() { const token = (await cookies()).get("matchmytone_access")?.value; if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 }); const upstream = await fetch(`${API_BASE}/quiz/results`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }); const data = await upstream.json().catch(() => ({})); return NextResponse.json(data, { status: upstream.status }); }
