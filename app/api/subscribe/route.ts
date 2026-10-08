import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId, unauthorized } from "@/lib/api-auth";
import { startSifaloCheckout } from "@/lib/sifalopay";
import { forbidden } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    // The authenticated session is the account; a client-supplied userId (if
    // any) must match it. The amount always comes from SIFALO_PRICE_USD
    // server-side and is never accepted from the request body.
    const body = (await request.json().catch(() => ({}))) as {
      userId?: string;
      amount?: unknown;
    };
    if (typeof body.amount !== "undefined") {
      return NextResponse.json(
        { message: "Amount is managed by the server" },
        { status: 400 }
      );
    }
    if (typeof body.userId !== "undefined" && body.userId !== sessionUserId) {
      return forbidden("You can only subscribe with your own account");
    }

    const url = await startSifaloCheckout(sessionUserId);

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Error starting Sifalo checkout:", err);
    const message =
      err instanceof Error ? err.message : "Failed to start checkout";
    return NextResponse.json({ message }, { status: 500 });
  }
}