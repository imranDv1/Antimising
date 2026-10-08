/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId, unauthorized } from "@/lib/api-auth";
import { fulfillSifaloPayment } from "@/lib/sifalopay";

export async function POST(request: NextRequest) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    // The session determines the user. Any order_id on the return URL is
    // deliberately ignored — it must never be trusted from the client.
    const { sid } = (await request.json().catch(() => ({}))) as {
      sid?: string;
    };

    if (!sid || typeof sid !== "string") {
      return NextResponse.json(
        { message: "sid is required" },
        { status: 400 }
      );
    }

    const result = await fulfillSifaloPayment({ sid, sessionUserId });

    if (!result.ok) {
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