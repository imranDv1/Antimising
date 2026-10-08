import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionUserId, unauthorized, forbidden } from "@/lib/api-auth";

export async function POST(request: Request) {
  const sessionUserId = await getSessionUserId();
  if (!sessionUserId) return unauthorized();

  const { quiry, userId } = await request.json();
  if (userId && userId !== sessionUserId) {
    return forbidden("You can only search your own notes");
  }

  const notes = await prisma.note.findMany({
    where: {
      userId: sessionUserId,
      title: {
        contains: quiry,
        mode: "insensitive",
      },
    },
  });

  if (notes.length === 0) {
    return NextResponse.json({ message: "No notes found" });
  }

  return NextResponse.json({ notes });
}
