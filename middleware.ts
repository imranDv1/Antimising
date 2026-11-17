import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import {
	APP_ENTERED_COOKIE,
	APP_ENTERED_COOKIE_OPTIONS,
	LANDING_BYPASS_COOKIE,
} from "@/lib/landing";

// Pages that only make sense while signed out.
// A signed-in visitor landing on one of these is sent straight to the dashboard.
const AUTH_ROUTES = ["/login", "/signup"];

function hasEnteredApp(request: NextRequest) {
	return request.cookies.get(APP_ENTERED_COOKIE)?.value === "1";
}

function markAppEntered(response: NextResponse) {
	response.cookies.set(APP_ENTERED_COOKIE, "1", APP_ENTERED_COOKIE_OPTIONS);
	return response;
}

export async function middleware(request: NextRequest) {
	const sessionCookie = getSessionCookie(request);
	const pathname = request.nextUrl.pathname.toLowerCase();

	// Landing page: only the FIRST entry in a browser session is redirected to
	// the dashboard. Once the app has been opened, "/" is visitable normally.
	if (pathname === "/") {
		if (request.cookies.get(LANDING_BYPASS_COOKIE)?.value === "1") {
			const response = NextResponse.next();
			response.cookies.delete(LANDING_BYPASS_COOKIE);
			return markAppEntered(response);
		}

		if (sessionCookie && !hasEnteredApp(request)) {
			return markAppEntered(
				NextResponse.redirect(new URL("/dashboard", request.url))
			);
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

	// The dashboard has been opened in this browser session, so "/" will no
	// longer redirect away from the landing page.
	const response = NextResponse.next();
	return hasEnteredApp(request) ? response : markAppEntered(response);
}

export const config = {
	matcher: [
		"/", // first signed-in visit goes to the dashboard
		"/dashboard/:path*", // protected app routes
		"/login", // redirect signed-in users to the dashboard
		"/signUp",
	],
};
