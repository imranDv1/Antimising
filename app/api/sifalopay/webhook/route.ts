import { NextResponse } from "next/server";
import { fulfillSifaloPayment } from "@/lib/sifalopay";

/**
 * Sifalo Pay webhook callback (public by design — Sifalo posts here without
 * authentication). It is never trusted on its own:
 *   - the sid is always re-verified with Sifalo (verify.php),
 *   - the order_id is only used to locate a pending payment row that was
 *     created server-side under an authenticated session,
 *   - fulfilment is idempotent per sid (see fulfillSifaloPayment).
 *
 * Definitive rejections return 200 so Sifalo stops retrying; transient errors
 * (e.g. verification unavailable) return 5xx so the payment can retry later.
 */
export async function POST(request: Request) {
  let body: { sid?: string; order_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  const sid = typeof body?.sid === "string" ? body.sid : "";
  const orderId =
    typeof body?.order_id === "string" ? body.order_id : undefined;

  if (!sid) {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  try {
    const result = await fulfillSifaloPayment({ sid, paymentId: orderId });

    if (!result.ok) {
      return NextResponse.json(
        { received: false, reason: result.reason },
        { status: result.retryable ? 500 : 200 }
      );
    }

    return NextResponse.json({ received: true, result: "ok" }, { status: 200 });
  } catch (err) {
    console.error("Sifalo webhook error:", err);
    // Transient — let Sifalo retry.
    return NextResponse.json({ received: false }, { status: 500 });
  }
}