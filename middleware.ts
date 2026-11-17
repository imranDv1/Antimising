import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { LANDING_BYPASS_COOKIE } from "@/lib/landing";

// Pages that only make sense while signed out.
// A signed-in visitor landing on one of these is sent straight to the dashboard.
const AUTH_ROUTES = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
	const sessionCookie = getSessionCookie(request);
	const pathname = request.nextUrl.pathname.toLowerCase();

	// Landing page: a signed-in visitor is sent to the dashboard, unless they
	// explicitly came from the dashboard (one-time bypass cookie).
	if (pathname === "/") {
		if (request.cookies.get(LANDING_BYPASS_COOKIE)?.value === "1") {
			const response = NextResponse.next();
			response.cookies.delete(LANDING_BYPASS_COOKIE);
			return response;
		}

		if (sessionCookie) {
			return NextResponse.redirect(new URL("/dashboard", request.url));
		}

		return NextResponse.next();
	}

	const isAuthRoute = AUTH_ROUTES.some(
		(route) => pathname === route || pathname.startsWith(`${route}/`),
	);

	// Signed in? Auth pages bounce to the dashboard automatically.
	if (isAuthRoute) {
		if (sessionCookie) {
			return NextResponse.redirect(new URL("/dashboard", request.url));
		}

		return NextResponse.next();
	}

	// Everything else matched here is a protected dashboard route.
	// THIS IS NOT SECURE!
	// This is the recommended approach to optimistically redirect users
	// We recommend handling auth checks in each page/route
	if (!sessionCookie) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		"/", // signed-in visitors go to the dashboard
		"/dashboard/:path*", // protected app routes
		"/login", // redirect signed-in users to the dashboard
		"/signUp",
	],
};
