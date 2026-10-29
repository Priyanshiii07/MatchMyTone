import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_BASE } from "../../../lib/auth";

// On Vercel, let stylist chat, looks and AI notes run for up to 60 s; the API keeps its AI time budget below that
// (COLOR_ANALYSIS_MAX_SECONDS / AI_TEXT_MAX_SECONDS on Render).
export const maxDuration = 60;

async function proxy(request, { params }) {
  const { path } = await params;
  const token = (await cookies()).get("matchmytone_access")?.value;
  const headers = new Headers(request.headers);
  headers.delete("host");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const init = { method: request.method, headers, cache: "no-store" };
  if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.text();
  const upstream = await fetch(`${API_BASE}/${path.join("/")}`, init);
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, { status: upstream.status, headers: { "content-type": upstream.headers.get("content-type") || "application/json" } });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
