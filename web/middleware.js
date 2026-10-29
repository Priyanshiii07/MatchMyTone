import { NextResponse } from "next/server";

export function middleware(request) {
  if (request.cookies.has("matchmytone_access")) return NextResponse.next();
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/history/:path*", "/analyses/:path*", "/results/:path*", "/stylist/:path*", "/board/:path*"],
};
