/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  encryptNotePayload,
  decryptNotePayload,
} from "@/lib/note-encryption";
import { getSessionUserId, unauthorized } from "@/lib/api-auth";
import {
  getPlanLimits,
  withUserScopeLock,
  PlanLimitError,
} from "@/lib/limits";

// Every board row must belong to the caller before it can be read or mutated.
async function getOwnedCanvas(id: string, userId: string) {
  if (!id) return { error: "id is required", status: 400 } as const;
  const canvas = await prisma.canvas.findUnique({ where: { id } });
  if (!canvas) return { error: "Canvas not found", status: 404 } as const;
  if (canvas.userId !== userId)
    return { error: "You do not own this canvas", status: 403 } as const;
  return { canvas } as const;
}

// GET /api/canvas        → list of the caller's boards (no content)
// GET /api/canvas?id=... → one board with its decrypted tldraw snapshot
export async function GET(request: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const owned = await getOwnedCanvas(id, sessionUserId);
      if ("error" in owned)
        return NextResponse.json({ message: owned.error }, { status: owned.status });

      let document: unknown = null;
      try {
        document = owned.canvas.contentEnc
          ? decryptNotePayload(owned.canvas.contentEnc)
          : null;
      } catch {
        // Fail closed: a corrupt payload never blocks the user from opening the board.
        document = null;
      }
      return NextResponse.json({
        canvas: {
          id: owned.canvas.id,
          title: owned.canvas.title,
          updatedAt: owned.canvas.updatedAt,
          document,
        },
      });
    }

    const canvases = await prisma.canvas.findMany({
      where: { userId: sessionUserId },
      select: { id: true, title: true, updatedAt: true, createdAt: true },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ canvases });
  } catch (error: any) {
    console.error("Error fetching canvases:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/canvas → create a new board for the caller
export async function POST(request: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { title } = await request.json().catch(() => ({}) as any);

    const limits = await getPlanLimits(sessionUserId);

    const canvas = await withUserScopeLock(
      sessionUserId,
      "canvas",
      async (tx) => {
        if (limits.canvasLimit !== null) {
          const owned = await tx.canvas.count({
            where: { userId: sessionUserId },
          });
          if (owned >= limits.canvasLimit) {
            throw new PlanLimitError(
              `Free plan is limited to ${limits.canvasLimit} canvas boards. Upgrade to Pro for unlimited.`
            );
          }
        }

        return tx.canvas.create({
          data: {
            userId: sessionUserId,
            title:
              typeof title === "string" && title.trim().length > 0
                ? title.trim().slice(0, 120)
                : "Untitled board",
          },
          select: { id: true, title: true, updatedAt: true, createdAt: true },
        });
      }
    );

    return NextResponse.json({ canvas }, { status: 201 });
  } catch (error: any) {
    if (error instanceof PlanLimitError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    console.error("Error creating canvas:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// PUT /api/canvas → rename and/or save the tldraw snapshot (autosave target)
export async function PUT(request: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { id, title, content } = await request.json();
    if (!id) {
      return NextResponse.json({ message: "id is required" }, { status: 400 });
    }

    const owned = await getOwnedCanvas(id, sessionUserId);
    if ("error" in owned)
      return NextResponse.json({ message: owned.error }, { status: owned.status });

    const data: Record<string, unknown> = {};
    if (typeof title === "string" && title.trim().length > 0) {
      data.title = title.trim().slice(0, 120);
    }
    if (content !== undefined) {
      if (content === null) {
        data.contentEnc = null;
      } else {
        data.contentEnc = encryptNotePayload(content);
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ message: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.canvas.update({
      where: { id },
      data,
      select: { id: true, title: true, updatedAt: true },
    });

    return NextResponse.json({ canvas: updated });
  } catch (error: any) {
    console.error("Error updating canvas:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/canvas?id=... → delete the caller's board
export async function DELETE(request: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    const owned = await getOwnedCanvas(id ?? "", sessionUserId);
    if ("error" in owned)
      return NextResponse.json({ message: owned.error }, { status: owned.status });

    await prisma.canvas.delete({ where: { id: owned.canvas.id } });
    return NextResponse.json({ message: "Canvas deleted" });
  } catch (error: any) {
    console.error("Error deleting canvas:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
