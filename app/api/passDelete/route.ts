import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionUserId, unauthorized, forbidden } from "@/lib/api-auth";

export async function DELETE(request: Request) {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return unauthorized();

  const { id, userId } = await request.json();
  if (!id) {
    return NextResponse.json({ message: "id is required" }, { status: 400 });
  }
  if (userId && userId !== sessionUserId) {
    return forbidden("You can only delete your own entries");
  }

  const pass = await prisma.passwordManeger.findUnique({
    where: { id },
  });
  if (!pass) {
    return NextResponse.json({ message: "pass not found" }, { status: 404 });
  }
  // Ownership is checked against the authenticated session, never the body.
  if (pass.userId !== sessionUserId) {
    return forbidden("You do not own this entry");
  }
  await prisma.passwordManeger.delete({
    where: { id },
  });
  return NextResponse.json({ message: "pass deleted successfully" }, { status: 200 });
}
