import { NextResponse } from "next/server";
import { getSessionUserId, unauthorized, forbidden } from "@/lib/api-auth";
import { getPlanLimits } from "@/lib/limits";
import { prisma } from "@/lib/db";

// Display-only endpoint. NOTE: authorization and limit enforcement must use
// getPlanLimits() server-side, never this endpoint.
export async function POST(request: Request) {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return unauthorized();

  try {
    const { userId } = await request.json().catch(() => ({}));

    if (typeof userId !== "undefined") {
      if (!userId) {
        return NextResponse.json(
          { message: "userId is required" },
          { status: 400 }
        );
      }
      if (userId !== sessionUserId) {
        return forbidden("You can only read your own subscription tier");
      }
    }

    const limits = await getPlanLimits(sessionUserId);

    const subscription = await prisma.subscription.findUnique({
      where: { userId: sessionUserId },
      select: { endDate: true },
    });

    return NextResponse.json({
      MAX_CHARS: limits.maxChars,
      limit: limits.imagesPerNote,
      isPro: limits.isPro,
      noteLimit: limits.noteLimit,
      imagesPerNote: limits.imagesPerNote,
      passwordLimit: limits.passwordLimit,
      canvasLimit: limits.canvasLimit,
      endsOn: subscription?.endDate?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("getSubs error:", err);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}