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

/**
 * A favorite may only exist for a note the caller can currently see: either
 * their own note, or one that is still shared with them. Without this check any
 * authenticated user could favorite an arbitrary note id and read its metadata.
 */
async function hasNoteAccess(
  noteId: string,
  userId: string
): Promise<boolean> {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: { userId: true },
  });
  if (!note) return false;
  if (note.userId === userId) return true;

  const share = await prisma.noteShare.findUnique({
    where: { noteId_userId: { noteId, userId } },
    select: { id: true },
  });
  return Boolean(share);
}

// Add a note to the user's favorites. Idempotent: adding an already-favorited
// note keeps it favorited instead of toggling it off, so a client with a stale
// star state can never accidentally remove the favorite.
export async function POST(req: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { userId, noteId } = await req.json();
    if (!noteId || typeof noteId !== "string") {
      return NextResponse.json({ error: "Missing noteId" }, { status: 400 });
    }

    const resolved = resolveUserId(sessionUserId, userId);
    if (resolved instanceof NextResponse) return resolved;

    if (!(await hasNoteAccess(noteId, resolved))) {
      // Same response for "does not exist" and "not yours" so note ids cannot
      // be probed for existence.
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

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
  } catch (err) {
    console.error("Favorite create failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Remove a note from the user's favorites (explicit DELETE)
export async function DELETE(req: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { userId, noteId } = await req.json();
    if (!noteId || typeof noteId !== "string") {
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

    // Scoped delete: the row is identified by session user + note id, so this
    // can only ever remove the caller's own favorite.
    await prisma.favoriteNote.delete({
      where: { userId_noteId: { userId: resolved, noteId } },
    });

    return NextResponse.json({ message: "Removed from favorites" }, { status: 200 });
  } catch (err) {
    console.error("Favorite delete failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
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
        note: {
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            createdAt: true,
            updatedAt: true,
            userId: true,
          },
        },
      },
    });

    // Access can be revoked after a note was favorited. Drop favorites whose
    // share is gone so revoked notes stop appearing in the list.
    const sharedNoteIds = new Set(
      (
        await prisma.noteShare.findMany({
          where: {
            userId: resolved,
            noteId: { in: favorites.map((favorite) => favorite.noteId) },
          },
          select: { noteId: true },
        })
      ).map((share) => share.noteId)
    );

    const visible = favorites.filter(
      (favorite) =>
        favorite.note.userId === resolved || sharedNoteIds.has(favorite.noteId)
    );

    return NextResponse.json(visible, { status: 200 });
  } catch (err) {
    console.error("Favorite list failed:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
