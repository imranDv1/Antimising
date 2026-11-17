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
 * Verify a payment with Sifalo (verify.php, no Basic auth).
 * Prefer `sid`; `orderId` is the documented fallback and returns only the most
 * recent payment for that reference.
 * Throws on network/HTTP errors (transient — caller may retry).
 * A declined/pending payment returns a response body with status != success.
 */
export async function verifySifaloPayment(input: {
  sid?: string;
  orderId?: string;
}): Promise<SifaloVerifyResult> {
  const { sid, orderId } = input;
  if (!sid && !orderId) {
    throw new Error("Sifalo verify requires a sid or an order_id");
  }

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sid ? { sid } : { order_id: orderId }),
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
  | {
      ok: false;
      reason: string;
      status: number;
      retryable?: boolean;
      /** Sifalo answered 603: still waiting for the customer's approval. */
      pending?: boolean;
    };

export type FulfillDeps = {
  /** Overridable in tests; production always uses the real verify.php. */
  verify?: (input: {
    sid?: string;
    orderId?: string;
  }) => Promise<SifaloVerifyResult>;
};

// Verify codes from Sifalo: 601 paid, 603 pending (keep polling, never charge
// again), 600/604 declined. See "Decline codes and timeouts".
const SUCCESS_CODE = 601;
const PENDING_CODE = 603;

type VerificationState = "paid" | "pending" | "failed";

function classifyVerification(
  verification: SifaloVerifyResult
): VerificationState {
  const code = Number(verification?.code);
  const status = String(verification?.status ?? "").toLowerCase();

  if (status === "success" && code === SUCCESS_CODE) return "paid";
  if (status === "pending" || code === PENDING_CODE) return "pending";
  return "failed";
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

/**
 * Persist a definitive decline (600/604) so the checkout stops showing as
 * pending. Only a pending/paid row is moved; fulfilled rows are never touched.
 */
async function markPaymentFailed(ref: {
  sid?: string;
  paymentId?: string;
  /** Success path: lets us find the checkout when Sifalo echoes no reference. */
  userId?: string;
}): Promise<void> {
  try {
    // A checkout row starts without a sid (it is attached on success), so look
    // it up by sid first and fall back to the order reference.
    const bySid = ref.sid
      ? await prisma.sifaloPayment.findUnique({ where: { sid: ref.sid } })
      : null;

    const byRef =
      ref.paymentId && !bySid
        ? await prisma.sifaloPayment.findUnique({
            where: { id: ref.paymentId },
          })
        : null;

    // Last resort (session path only): a checkout row has neither sid nor a
    // matching order reference until it succeeds, so use this user's newest
    // pending checkout.
    const byUser =
      !bySid && !byRef && ref.userId
        ? await prisma.sifaloPayment.findFirst({
            where: {
              userId: ref.userId,
              status: "pending",
              amount: priceUsd(),
              currency: CURRENCY,
            },
            orderBy: { createdAt: "desc" },
          })
        : null;

    const target = bySid ?? byRef ?? byUser;
    if (!target) return;
    // A fresh verify is authoritative: it may contradict a stale/hand-edited
    // "paid" row. Never downgrade a "fulfilled" row (subscription already
    // written) and never resurrect a terminal "failed" one.
    if (target.status !== "pending" && target.status !== "paid") return;

    await prisma.sifaloPayment.update({
      where: { id: target.id },
      data: {
        status: "failed",
        ...(ref.sid ? { sid: ref.sid } : {}),
      },
    });
  } catch (err) {
    console.error("Failed to mark Sifalo payment as failed:", err);
  }
}

/**
 * Fulfil a verified Sifalo payment. Shared by /api/subscribe/success
 * (session-authenticated) and /api/sifalopay/webhook.
 *
 * Payment row states:
 * - pending   checkout created, money not confirmed yet
 * - paid      Sifalo confirmed the money, subscription write not committed
 * - fulfilled subscription written (terminal success; never extended twice)
 * - failed    declined / insufficient balance (terminal)
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
  /** Transaction reference from the return URL / webhook. Preferred. */
  sid?: string;
  /** Success path: the authenticated session user. */
  sessionUserId?: string;
  /** order_id as a fallback reference (verify.php supports it). */
  paymentId?: string;
  deps?: FulfillDeps;
}): Promise<FulfillOutcome> {
  const { sessionUserId } = opts;
  const sid = opts.sid?.trim() || undefined;
  const orderId = opts.paymentId?.trim() || undefined;
  const verify = opts.deps?.verify ?? verifySifaloPayment;
  const amount = priceUsd();

  if (!sid && !orderId) {
    return { ok: false, reason: "sid or order_id is required", status: 400 };
  }

  // 1. Replay guard: a "fulfilled" row is fully done. A "paid" row is NOT
  // trusted on its own — verify.php is the source of truth, so fall through
  // and re-verify before writing any subscription.
  if (sid) {
    const existingBySid = await prisma.sifaloPayment.findUnique({
      where: { sid },
    });
    if (existingBySid?.status === "fulfilled") {
      return { ok: true, alreadyFulfilled: true };
    }
  }

  // 2. Server-side verification. Never trust caller-supplied status/amount.
  let verification: SifaloVerifyResult;
  try {
    verification = await verify({ sid, orderId });
  } catch {
    return {
      ok: false,
      reason: "Sifalo verification is unavailable, please try again",
      status: 502,
      retryable: true,
    };
  }

  const state = classifyVerification(verification);

  // 603: the customer still has to approve on their phone. Keep the row
  // pending and let the caller poll verify again — never charge twice.
  if (state === "pending") {
    return {
      ok: false,
      pending: true,
      reason:
        verification.response ||
        "Sifalo is still waiting for the payment to be approved",
      status: 202,
    };
  }

  if (state === "failed") {
    // Declined / insufficient balance (600, 604) is terminal. Persist it so the
    // row no longer shows as pending and reconciliation stops polling it.
    await markPaymentFailed({
      sid: verification.sid?.trim() || sid,
      paymentId: verification.order_id || orderId,
      userId: sessionUserId,
    });

    return {
      ok: false,
      reason: verification.response || "Payment was not confirmed by Sifalo",
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

  // Sifalo echoes the transaction reference on verify, which is the only way
  // to get one when we verified by order_id. Never fulfil without it, since
  // it is the replay guard.
  const effectiveSid = verification.sid?.trim() || sid;

  if (!effectiveSid) {
    return {
      ok: false,
      reason: "Sifalo did not return a transaction reference",
      status: 502,
      retryable: true,
    };
  }

  if (effectiveSid !== sid) {
    const claimedBySid = await prisma.sifaloPayment.findUnique({
      where: { sid: effectiveSid },
    });
    if (claimedBySid?.status === "fulfilled") {
      return { ok: true, alreadyFulfilled: true };
    }
    if (claimedBySid?.status === "paid") {
      return applySubscription(claimedBySid);
    }
  }

  // Prefer the server-created order reference. Sifalo's echoed order_id is
  // only a hint (hosted checkout may return its own internal id), so it is
  // never allowed to override ours or to fail the fulfilment.
  const resolvedPaymentId = orderId || verification.order_id;

  // 3. Resolve the server-created payment row this transaction pays for.
  let row = resolvedPaymentId
    ? await prisma.sifaloPayment.findUnique({
        where: { id: resolvedPaymentId },
      })
    : null;

  // The verified sid is the authoritative identity: if the order reference
  // does not resolve to one of our rows, fall back to the sid.
  if (!row) {
    row = await prisma.sifaloPayment.findUnique({
      where: { sid: effectiveSid },
    });
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
      let created: { id: string; userId: string; paidAt: Date | null };
      try {
        created = await prisma.sifaloPayment.create({
          data: {
            userId: sessionUserId,
            amount,
            currency: CURRENCY,
            // The subscription is written by applySubscription below; the row
            // only becomes "fulfilled" once that write succeeds.
            status: "paid",
            sid: effectiveSid,
            paidAt: new Date(),
          },
        });
      } catch (err) {
        if (isUniqueViolation(err)) {
          // A concurrent request already created the row for this sid.
          const raced = await prisma.sifaloPayment.findUnique({
            where: { sid: effectiveSid },
          });
          if (!raced) return { ok: true, alreadyFulfilled: true };
          if (raced.status === "fulfilled") {
            return { ok: true, alreadyFulfilled: true };
          }
          if (raced.status === "paid") return applySubscription(raced);
          return claimPayment(raced, effectiveSid);
        }
        throw err;
      }
      return applySubscription(created);
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

  // 4. Only now, with a fresh 601 from Sifalo and ownership/amount checked, is
  // a row allowed to activate Pro. A leftover "paid" row is healed without
  // extending twice; anything else takes the atomic pending -> paid claim.
  if (row.status === "fulfilled") {
    return { ok: true, alreadyFulfilled: true };
  }
  if (row.status === "paid") {
    return applySubscription(row);
  }
  return claimPayment(row, effectiveSid);
}

/**
 * Move a verified payment from pending/failed to paid.
 *
 * The updateMany is the concurrency guard: exactly one caller wins. Every
 * loser inspects the row instead of assuming success.
 */
async function claimPayment(
  row: { id: string; userId: string; paidAt?: Date | null },
  effectiveSid: string
): Promise<FulfillOutcome> {
  const paidAt = new Date();
  try {
    const claimed = await prisma.sifaloPayment.updateMany({
      where: { id: row.id, status: { in: ["pending", "failed"] } },
      data: { status: "paid", sid: effectiveSid, paidAt },
    });

    if (claimed.count === 0) {
      const current = await prisma.sifaloPayment.findUnique({
        where: { id: row.id },
      });
      if (current?.status === "fulfilled") {
        return { ok: true, alreadyFulfilled: true };
      }
      if (current?.status === "paid") {
        return applySubscription(current);
      }
      return { ok: false, reason: "Payment could not be claimed", status: 409 };
    }
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Another request attached this sid first — finish that row instead.
      const existing = await prisma.sifaloPayment.findUnique({
        where: { sid: effectiveSid },
      });
      if (!existing) {
        // Row already finished (or vanished); the money is handled.
        return { ok: true, alreadyFulfilled: true };
      }
      if (existing.status === "fulfilled") {
        return { ok: true, alreadyFulfilled: true };
      }
      if (existing.status === "paid") {
        return applySubscription(existing);
      }
      if (existing.id === row.id) {
        return {
          ok: false,
          reason: "Payment could not be claimed",
          status: 409,
        };
      }
      return claimPayment(existing, effectiveSid);
    }
    throw err;
  }

  return applySubscription({ ...row, paidAt });
}

/**
 * Write the Pro subscription for a "paid" row, atomically moving it to the
 * terminal "fulfilled" state first. If the subscription write throws, the row
 * is reverted to "paid" so the next replay/reconciliation retries it instead
 * of leaving a paid record that never grants Pro.
 */
async function applySubscription(row: {
  id: string;
  userId: string;
  paidAt?: Date | null;
}): Promise<FulfillOutcome> {
  const claimed = await prisma.sifaloPayment.updateMany({
    where: { id: row.id, status: "paid" },
    data: { status: "fulfilled" },
  });

  if (claimed.count === 0) {
    const current = await prisma.sifaloPayment.findUnique({
      where: { id: row.id },
    });
    if (current?.status === "fulfilled") {
      return { ok: true, alreadyFulfilled: true };
    }
    // Still pending/failed: the caller's claim was lost or reverted elsewhere.
    return { ok: false, reason: "Payment could not be fulfilled", status: 409 };
  }

  try {
    // Rows written before the "fulfilled" state existed are still "paid" even
    // when their subscription was created. If the subscription was written at
    // or after this payment was confirmed, treat it as already applied instead
    // of granting a second month.
    const paidAt = row.paidAt ?? null;
    const subscription = paidAt
      ? await prisma.subscription.findUnique({
          where: { userId: row.userId },
          select: { updatedAt: true },
        })
      : null;
    const alreadyApplied =
      !!subscription &&
      !!paidAt &&
      subscription.updatedAt.getTime() >= paidAt.getTime();

    if (!alreadyApplied) {
      await extendSubscription(row.userId);
    }
  } catch (err) {
    await prisma.sifaloPayment
      .updateMany({
        where: { id: row.id, status: "fulfilled" },
        data: { status: "paid" },
      })
      .catch((revertErr) =>
        console.error("Failed to revert Sifalo payment:", revertErr)
      );
    throw err;
  }

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

// A wallet payment can clear after the customer leaves the return page, and
// Sifalo does not send a second webhook for a pending -> paid transition. This
// re-verifies recent pending checkouts, and heals "paid" rows whose
// subscription write never landed, so Pro turns on the next time the user uses
// the app without revisiting the payment page.
export async function reconcileSifaloPayments(
  userId: string
): Promise<boolean> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Pass 1: paid but not fulfilled. Re-verify with Sifalo instead of trusting
  // the stored status, so a stale or hand-edited row can never grant Pro.
  const paidRows = await prisma.sifaloPayment.findMany({
    where: { userId, status: "paid", sid: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, sid: true },
  });

  let upgraded = false;
  for (const payment of paidRows) {
    if (!payment.sid) continue;
    try {
      const result = await fulfillSifaloPayment({
        sid: payment.sid,
        // Resolve this exact row even when verify echoes a different order_id.
        paymentId: payment.id,
      });
      if (result.ok && !result.alreadyFulfilled) upgraded = true;
    } catch (err) {
      console.error("Sifalo paid payment healing failed:", err);
    }
  }

  if (upgraded) return true;

  // Pass 2: pending checkouts that may have been approved since.
  const pendingRows = await prisma.sifaloPayment.findMany({
    where: {
      userId,
      status: "pending",
      createdAt: { gte: cutoff },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true },
  });

  for (const payment of pendingRows) {
    try {
      const result = await fulfillSifaloPayment({ paymentId: payment.id });
      // A definitive decline also resolves here: fulfill marks the row failed.
      if (result.ok) return !result.alreadyFulfilled;
    } catch (err) {
      // One bad reference must not stop the others from being reconciled.
      console.error("Pending payment reconciliation failed:", err);
    }
  }

  return false;
}