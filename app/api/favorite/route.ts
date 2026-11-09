/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUserId, unauthorized, forbidden } from "@/lib/api-auth";

// Only the authenticated session user may read/modify their own favorites.
function resolveUserId(
  sessionUserId: string,
  requestedUserId: string | null | undefined
): NextResponse | string {
  if (!requestedUserId) return sessionUserId;
  if (requestedUserId !== sessionUserId) {
    return forbidden("You can only access your own favorites");
  }
  return sessionUserId;
}

// Add a note to the user's favorites. Idempotent: adding an already-favorited
// note keeps it favorited instead of toggling it off, so a client with a stale
// star state can never accidentally remove the favorite.
export async function POST(req: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { userId, noteId } = await req.json();
    if (!noteId) {
      return NextResponse.json({ error: "Missing noteId" }, { status: 400 });
    }

    const resolved = resolveUserId(sessionUserId, userId);
    if (resolved instanceof NextResponse) return resolved;

    const existing = await prisma.favoriteNote.findUnique({
      where: { userId_noteId: { userId: resolved, noteId } },
    });

    if (existing) {
      return NextResponse.json(
        { message: "Already in favorites", favorite: existing, removed: false },
        { status: 200 }
      );
    }

    const favorite = await prisma.favoriteNote.create({
      data: { userId: resolved, noteId },
    });

    return NextResponse.json({ message: "Added to favorites", favorite, removed: false }, { status: 201 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

// Remove a note from the user's favorites (explicit DELETE)
export async function DELETE(req: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { userId, noteId } = await req.json();
    if (!noteId) {
      return NextResponse.json({ error: "Missing noteId" }, { status: 400 });
    }

    const resolved = resolveUserId(sessionUserId, userId);
    if (resolved instanceof NextResponse) return resolved;

    const existing = await prisma.favoriteNote.findUnique({
      where: { userId_noteId: { userId: resolved, noteId } },
    });

    if (!existing) {
      // Already not favorite — treat as success so stale client state never
      // surfaces an error toast.
      return NextResponse.json(
        { message: "Note not in favorites", removed: true },
        { status: 200 }
      );
    }

    await prisma.favoriteNote.delete({
      where: { userId_noteId: { userId: resolved, noteId } },
    });

    return NextResponse.json({ message: "Removed from favorites" }, { status: 200 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}

// Get all favorites (with their notes) for the session user
export async function GET(req: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { searchParams } = new URL(req.url);
    const resolved = resolveUserId(sessionUserId, searchParams.get("userId"));
    if (resolved instanceof NextResponse) return resolved;

    const favorites = await prisma.favoriteNote.findMany({
      where: { userId: resolved },
      include: {
        note: true,
      },
    });

    return NextResponse.json(favorites, { status: 200 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
