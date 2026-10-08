import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionUserId, unauthorized, forbidden } from "@/lib/api-auth";

export async function POST(request: Request) {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return unauthorized();

  const { userId } = await request.json();

  if (!userId) {
    return NextResponse.json({ message: "userId is required" }, { status: 400 });
  }
  if (userId !== sessionUserId) {
    return forbidden("You can only read your own subscription tier");
  }

  const subs = await prisma.subscription.findMany({
    where: { userId: sessionUserId },
  });

  const hasSubs = subs.length > 0;
  const MAX_CHARS = hasSubs ? 5000 : 1000;
  const limit = hasSubs ? 10 : 3;

  return NextResponse.json({ MAX_CHARS, limit });
}
