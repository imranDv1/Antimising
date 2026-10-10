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

// A user may favorite a board they own or one shared with them.
async function hasCanvasAccess(
  canvasId: string,
  userId: string
): Promise<boolean> {
  const canvas = await prisma.canvas.findUnique({
    where: { id: canvasId },
    select: { userId: true },
  });
  if (!canvas) return false;
  if (canvas.userId === userId) return true;

  const share = await prisma.canvasShare.findUnique({
    where: { canvasId_userId: { canvasId, userId } },
    select: { id: true },
  });
  return Boolean(share);
}

// Add/remove a board from the user's favorites (toggle)
export async function POST(req: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { userId, canvasId } = await req.json();
    if (!canvasId) {
      return NextResponse.json({ error: "Missing canvasId" }, { status: 400 });
    }

    const resolved = resolveUserId(sessionUserId, userId);
    if (resolved instanceof NextResponse) return resolved;

    if (!(await hasCanvasAccess(canvasId, resolved))) {
      return forbidden("You do not have access to this canvas");
    }

    const existing = await prisma.favoriteCanvas.findUnique({
      where: { userId_canvasId: { userId: resolved, canvasId } },
    });

    if (existing) {
      await prisma.favoriteCanvas.delete({
        where: { userId_canvasId: { userId: resolved, canvasId } },
      });
      return NextResponse.json(
        { message: "Removed from favorites", removed: true },
        { status: 200 }
      );
    }

    const favorite = await prisma.favoriteCanvas.create({
      data: { userId: resolved, canvasId },
    });

    return NextResponse.json(
      { message: "Added to favorites", favorite, removed: false },
      { status: 201 }
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

// Remove a board from the user's favorites (explicit DELETE)
export async function DELETE(req: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { userId, canvasId } = await req.json();
    if (!canvasId) {
      return NextResponse.json({ error: "Missing canvasId" }, { status: 400 });
    }

    const resolved = resolveUserId(sessionUserId, userId);
    if (resolved instanceof NextResponse) return resolved;

    const existing = await prisma.favoriteCanvas.findUnique({
      where: { userId_canvasId: { userId: resolved, canvasId } },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Board not in favorites" },
        { status: 404 }
      );
    }

    await prisma.favoriteCanvas.delete({
      where: { userId_canvasId: { userId: resolved, canvasId } },
    });

    return NextResponse.json(
      { message: "Removed from favorites" },
      { status: 200 }
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

// Get all favorite boards (with their canvas) for the session user
export async function GET(req: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { searchParams } = new URL(req.url);
    const resolved = resolveUserId(sessionUserId, searchParams.get("userId"));
    if (resolved instanceof NextResponse) return resolved;

    const [favorites, shares] = await Promise.all([
      prisma.favoriteCanvas.findMany({
        where: { userId: resolved },
        include: {
          canvas: {
            select: {
              id: true,
              title: true,
              userId: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.canvasShare.findMany({
        where: { userId: resolved },
        select: { canvasId: true, permission: true },
      }),
    ]);

    const sharePermission = new Map(
      shares.map((share) => [share.canvasId, share.permission])
    );

    return NextResponse.json(
      favorites.map((favorite) => ({
        ...favorite,
        permission:
          favorite.canvas.userId === resolved
            ? "owner"
            : (sharePermission.get(favorite.canvasId) ?? "read"),
      })),
      { status: 200 }
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
