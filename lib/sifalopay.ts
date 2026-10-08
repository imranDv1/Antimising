import { prisma } from "@/lib/db";

const GATEWAY_URL = "https://api.sifalopay.com/gateway/";
const VERIFY_URL = "https://api.sifalopay.com/gateway/verify.php";
const CHECKOUT_URL = "https://pay.sifalo.com/checkout/";
const CURRENCY = "USD";

function priceUsd(): string {
  const price = process.env.SIFALO_PRICE_USD?.trim();
  if (!price || Number.isNaN(Number(price)) || Number(price) <= 0) {
    throw new Error("SIFALO_PRICE_USD is not configured");
  }
  return price;
}

function basicAuthHeader(): string {
  const user = process.env.SIFALO_API_USER || process.env.SIFALO_USERNAME;
  const key = process.env.SIFALO_API_KEY;
  if (!user || !key) {
    throw new Error("Sifalo API credentials are not configured");
  }
  return `Basic ${Buffer.from(`${user}:${key}`).toString("base64")}`;
}

export type SifaloVerifyResult = {
  sid?: string;
  status?: string;
  code?: number | string;
  amount?: string | number;
  currency?: string;
  order_id?: string;
  account?: string;
  payment_type?: string;
  response?: string;
};

/**
 * Verify a sid with Sifalo (verify.php, no Basic auth).
 * Throws on network/HTTP errors (transient — caller may retry).
 * A declined payment returns a response body with status != success.
 */
export async function verifySifaloSid(
  sid: string
): Promise<SifaloVerifyResult> {
  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sid }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Sifalo verify failed (HTTP ${res.status})`);
  }
  return (await res.json()) as SifaloVerifyResult;
}

/**
 * Start a hosted checkout. Creates a server-side SifaloPayment row (the
 * payment identity) and returns the Sifalo checkout URL. The amount always
 * comes from SIFALO_PRICE_USD server-side — never from the client.
 */
export async function startSifaloCheckout(userId: string): Promise<string> {
  const amount = priceUsd();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is not configured");
  }

  const payment = await prisma.sifaloPayment.create({
    data: { userId, amount, currency: CURRENCY },
    select: { id: true },
  });

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      gateway: "checkout",
      currency: CURRENCY,
      return_url: `${appUrl}/subscribe/success?order_id=${payment.id}`,
      webhook_url: `${appUrl}/api/sifalopay/webhook`,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    throw new Error(`Sifalo gateway error (HTTP ${res.status})`);
  }

  const data = (await res.json()) as { key?: string; token?: string };
  if (!data?.key || !data?.token) {
    throw new Error("Sifalo gateway did not return a checkout key/token");
  }

  return `${CHECKOUT_URL}?key=${encodeURIComponent(data.key)}&token=${encodeURIComponent(data.token)}`;
}

/**
 * Compute the new subscription expiry after a renewal.
 * Preserves remaining paid time: if the current subscription is still active
 * (endDate in the future), the new expiry is computed from the existing
 * endDate; otherwise it starts from now.
 */
export function computeNewEndDate(
  currentEnd: Date | null | undefined,
  now: Date = new Date()
): Date {
  const base =
    currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  const next = new Date(base.getTime());
  next.setMonth(next.getMonth() + 1);
  return next;
}

export type FulfillOutcome =
  | { ok: true; alreadyFulfilled: boolean }
  | { ok: false; reason: string; status: number; retryable?: boolean };

export type FulfillDeps = {
  /** Overridable in tests; production always uses the real verify.php. */
  verify?: (sid: string) => Promise<SifaloVerifyResult>;
};

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

/**
 * Fulfil a verified Sifalo payment. Shared by /api/subscribe/success
 * (session-authenticated) and /api/sifalopay/webhook.
 *
 * Identity rules:
 * - The authenticated session always determines the user on the success path.
 * - The verified sid is the payment identity (replay-proof via the unique sid).
 * - order_id from a webhook is only ever used to LOCATE a pending payment row
 *   that was created server-side under an authenticated session — never taken
 *   at face value as the user.
 * - Amount/currency returned by Sifalo verification must match the configured
 *   plan price.
 */
export async function fulfillSifaloPayment(opts: {
  sid: string;
  /** Success path: the authenticated session user. */
  sessionUserId?: string;
  /** Webhook path: order_id as a candidate key for a pending payment row. */
  paymentId?: string;
  deps?: FulfillDeps;
}): Promise<FulfillOutcome> {
  const { sid, sessionUserId, paymentId } = opts;
  const verify = opts.deps?.verify ?? verifySifaloSid;
  const amount = priceUsd();

  if (!sid || typeof sid !== "string") {
    return { ok: false, reason: "sid is required", status: 400 };
  }

  // 1. Replay guard: this sid was already verified and fulfilled.
  const existingBySid = await prisma.sifaloPayment.findUnique({
    where: { sid },
  });
  if (existingBySid) {
    if (existingBySid.status === "paid") {
      return { ok: true, alreadyFulfilled: true };
    }
    // Row holds the sid but is not yet marked paid — fall through to the
    // atomic claim below.
  }

  // 2. Server-side verification. Never trust caller-supplied status/amount.
  let verification: SifaloVerifyResult;
  try {
    verification = await verify(sid);
  } catch {
    return {
      ok: false,
      reason: "Sifalo verification is unavailable, please try again",
      status: 502,
      retryable: true,
    };
  }

  if (
    !verification ||
    verification.status !== "success" ||
    Number(verification.code) !== 601
  ) {
    return {
      ok: false,
      reason: "Payment was not confirmed by Sifalo",
      status: 402,
    };
  }

  if (
    verification.amount !== undefined &&
    verification.amount !== null &&
    Number(verification.amount) !== Number(amount)
  ) {
    return {
      ok: false,
      reason: "Payment amount does not match the plan price",
      status: 402,
    };
  }

  if (
    verification.currency &&
    String(verification.currency).toUpperCase() !== CURRENCY
  ) {
    return {
      ok: false,
      reason: "Payment currency does not match the plan price",
      status: 402,
    };
  }

  // If verification echoes an order reference, treat it as authoritative and
  // make sure it agrees with anything the caller supplied.
  if (
    verification.order_id &&
    paymentId &&
    verification.order_id !== paymentId
  ) {
    return {
      ok: false,
      reason: "Payment reference does not match the checkout",
      status: 402,
    };
  }
  const resolvedPaymentId = verification.order_id || paymentId;

  // 3. Resolve the server-created payment row this sid pays for.
  let row = resolvedPaymentId
    ? await prisma.sifaloPayment.findUnique({
        where: { id: resolvedPaymentId },
      })
    : null;

  if (row && row.status === "paid") {
    return { ok: true, alreadyFulfilled: true };
  }

  if (!row && sessionUserId) {
    // Success path: the session determines the user. Prefer their most recent
    // pending checkout at the plan price; otherwise create a paid record,
    // since Sifalo has already confirmed the money.
    row = await prisma.sifaloPayment.findFirst({
      where: {
        userId: sessionUserId,
        status: "pending",
        amount,
        currency: CURRENCY,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!row) {
      try {
        await prisma.sifaloPayment.create({
          data: {
            userId: sessionUserId,
            amount,
            currency: CURRENCY,
            status: "paid",
            sid,
            paidAt: new Date(),
          },
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          return { ok: true, alreadyFulfilled: true };
        }
        throw err;
      }
      await extendSubscription(sessionUserId);
      return { ok: true, alreadyFulfilled: false };
    }
  }

  if (!row) {
    // Webhook with an unknown/overridable reference and no session: we cannot
    // bind it to a user, so never fulfil from the reference alone.
    return {
      ok: false,
      reason: "Unknown payment reference",
      status: 404,
    };
  }

  if (sessionUserId && row.userId !== sessionUserId) {
    return {
      ok: false,
      reason: "This payment does not belong to your account",
      status: 403,
    };
  }

  if (row.amount !== amount || row.currency !== CURRENCY) {
    return {
      ok: false,
      reason: "Payment amount does not match the plan price",
      status: 402,
    };
  }

  // 4. Atomic claim: only one concurrent caller can move pending -> paid for
  // this row (and this sid). This is what makes repeated success/webhook calls
  // idempotent.
  try {
    const claimed = await prisma.sifaloPayment.updateMany({
      where: { id: row.id, status: "pending" },
      data: { status: "paid", sid, paidAt: new Date() },
    });

    if (claimed.count === 0) {
      const current = await prisma.sifaloPayment.findUnique({
        where: { id: row.id },
      });
      if (current?.status === "paid") {
        return { ok: true, alreadyFulfilled: true };
      }
      return { ok: false, reason: "Payment could not be claimed", status: 409 };
    }
  } catch (err) {
    // Unique(sid) violation means another request fulfilled this sid.
    if (isUniqueViolation(err)) {
      return { ok: true, alreadyFulfilled: true };
    }
    throw err;
  }

  await extendSubscription(row.userId);
  return { ok: true, alreadyFulfilled: false };
}

async function extendSubscription(userId: string) {
  const now = new Date();
  const existing = await prisma.subscription.findUnique({
    where: { userId },
  });
  const endDate = computeNewEndDate(existing?.endDate, now);

  await prisma.subscription.upsert({
    where: { userId },
    update: { endDate, isActive: true },
    create: {
      userId,
      startDate: existing?.startDate ?? now,
      endDate,
      isActive: true,
    },
  });
}