import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

/**
 * Shared auth helpers for API routes.
 *
 * Every state-reading/state-changing route must:
 *   1. `const userId = await getSessionUserId()`  → 401 if null
 *   2. verify any `userId` coming from the client equals the session user  → 403
 *
 * Exceptions (intentionally session-less):
 *   - /api/auth/*        (Better Auth handler)
 *   - /api/stripe/webhook (verified via Stripe HMAC signature)
 */

export async function getSessionUserId(): Promise<string | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

export function unauthorized(message = "Unauthorized"): NextResponse {
  return NextResponse.json({ message }, { status: 401 });
}

export function forbidden(message = "Forbidden"): NextResponse {
  return NextResponse.json({ message }, { status: 403 });
}
