// A signed-in visitor who opens "/" is sent to the dashboard, but only on their
// first entry to the app in a browser session: once the dashboard has been
// opened, this session cookie is set and "/" stays freely visitable.
export const APP_ENTERED_COOKIE = "app-entered";

// A one-shot escape hatch for the very first dashboard render (before the
// marker above is applied by the browser), used by the sidebar logo link.
export const LANDING_BYPASS_COOKIE = "visit-landing";

const MAX_AGE_SECONDS = 60;

export const APP_ENTERED_COOKIE_OPTIONS = {
	path: "/",
	sameSite: "lax",
} as const;

export function allowLandingVisit() {
	if (typeof document === "undefined") return;

	document.cookie = `${LANDING_BYPASS_COOKIE}=1; path=/; max-age=${MAX_AGE_SECONDS}; samesite=lax`;
}
