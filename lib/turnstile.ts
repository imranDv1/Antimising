const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
};

/**
 * Verifies a Cloudflare Turnstile token against the siteverify API.
 * Tokens are single use and expire after ~5 minutes.
 */
export async function verifyTurnstileToken(
  token?: string | null
): Promise<boolean> {
  const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET;
  if (!secret) {
    console.error("CLOUDFLARE_TURNSTILE_SECRET is not set");
    return false;
  }
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });

    if (!response.ok) return false;

    const data = (await response.json()) as TurnstileVerifyResponse;
    return data.success === true;
  } catch (error) {
    console.error("Turnstile verification failed", error);
    return false;
  }
}
