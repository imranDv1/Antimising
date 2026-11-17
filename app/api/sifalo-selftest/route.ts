import { NextRequest, NextResponse } from "next/server";
import { fulfillSifaloPayment } from "@/lib/sifalopay";

// TEMPORARY test route — deleted after verification.
export async function POST(request: NextRequest) {
  const { userId, sid } = await request.json();
  const result = await fulfillSifaloPayment({
    sid,
    sessionUserId: userId,
    deps: {
      verify: async () => ({
        sid,
        status: "success",
        code: 601,
        amount: process.env.SIFALO_PRICE_USD?.trim() || "9",
        currency: "USD",
        response: "Payment was successful",
      }),
    },
  });
  return NextResponse.json(result);
}
