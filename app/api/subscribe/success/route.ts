/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId, unauthorized } from "@/lib/api-auth";
import { fulfillSifaloPayment } from "@/lib/sifalopay";

export async function POST(request: NextRequest) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    // The session determines the user. order_id only ever selects which of
    // THIS user's server-created checkout rows is being verified, and the
    // payment is still confirmed by Sifalo's verify.php, never by this body.
    const { sid, order_id } = (await request.json().catch(() => ({}))) as {
      sid?: string;
      order_id?: string;
    };

    const hasSid = typeof sid === "string" && sid.trim().length > 0;
    const hasOrderId =
      typeof order_id === "string" && order_id.trim().length > 0;

    if (!hasSid && !hasOrderId) {
      return NextResponse.json(
        { message: "sid or order_id is required" },
        { status: 400 }
      );
    }

    const result = await fulfillSifaloPayment({
      sid: hasSid ? sid : undefined,
      paymentId: hasOrderId ? order_id : undefined,
      sessionUserId,
    });

    if (!result.ok) {
      // 603: the wallet charge is still waiting for approval on the customer's
      // phone. The client polls this endpoint again until Sifalo answers 601.
      if (result.pending) {
        return NextResponse.json(
          { success: false, pending: true, message: result.reason },
          { status: 202 }
        );
      }

      return NextResponse.json(
        { message: result.reason },
        { status: result.status }
      );
    }

    return NextResponse.json({
      success: true,
      alreadyFulfilled: result.alreadyFulfilled,
    });
  } catch (err: any) {
    console.error("Error saving subscription:", err);
    return NextResponse.json(
      { message: err.message || "Failed to save subscription" },
      { status: 500 }
    );
  }
}
