// A signed-in visitor who opens "/" is sent to the dashboard, but the dashboard
// itself needs a way to reach the landing page. Clicking such a link drops this
// short-lived cookie, which the middleware consumes once and clears.
export const LANDING_BYPASS_COOKIE = "visit-landing";

const MAX_AGE_SECONDS = 60;

export function allowLandingVisit() {
	if (typeof document === "undefined") return;

	document.cookie = `${LANDING_BYPASS_COOKIE}=1; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}
