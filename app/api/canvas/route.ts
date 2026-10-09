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
import type { Canvas } from "@/lib/generated/prisma";

type BoardPermission = "owner" | "read" | "write";

const boardSelect = {
  id: true,
  title: true,
  updatedAt: true,
  createdAt: true,
} as const;

// A board row plus the caller's relationship to it. "owner" means full
// control; a share grant is either "read" (view only) or "write" (edit).
async function getCanvasAccess(
  id: string,
  userId: string
): Promise<{ error: string; status: number } | { canvas: Canvas; permission: BoardPermission }> {
  if (!id) return { error: "id is required", status: 400 };
  const canvas = await prisma.canvas.findUnique({ where: { id } });
  if (!canvas) return { error: "Canvas not found", status: 404 };
  if (canvas.userId === userId) return { canvas, permission: "owner" };

  const share = await prisma.canvasShare.findUnique({
    where: { canvasId_userId: { canvasId: id, userId } },
    select: { permission: true },
  });
  if (!share)
    return { error: "You do not have access to this canvas", status: 403 };

  return { canvas, permission: share.permission as BoardPermission };
}

// GET /api/canvas            → the caller's boards plus the ones shared with them
// GET /api/canvas?id=...     → one board with its decrypted Excalidraw scene
export async function GET(request: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (id) {
      const access = await getCanvasAccess(id, sessionUserId);
      if ("error" in access)
        return NextResponse.json({ message: access.error }, { status: access.status });

      let document: unknown = null;
      try {
        document = access.canvas.contentEnc
          ? decryptNotePayload(access.canvas.contentEnc)
          : null;
      } catch {
        // Fail closed: a corrupt payload never blocks the user from opening the board.
        document = null;
      }
      return NextResponse.json({
        canvas: {
          id: access.canvas.id,
          title: access.canvas.title,
          updatedAt: access.canvas.updatedAt,
          document,
          permission: access.permission,
        },
      });
    }

    const [canvases, shares] = await Promise.all([
      prisma.canvas.findMany({
        where: { userId: sessionUserId },
        select: boardSelect,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.canvasShare.findMany({
        where: { userId: sessionUserId },
        select: {
          permission: true,
          createdAt: true,
          canvas: {
            select: {
              ...boardSelect,
              user: { select: { name: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      canvases: canvases.map((canvas) => ({ ...canvas, permission: "owner" })),
      sharedCanvases: shares.map((share) => ({
        id: share.canvas.id,
        title: share.canvas.title,
        updatedAt: share.canvas.updatedAt,
        createdAt: share.canvas.createdAt,
        permission: share.permission,
        ownerName: share.canvas.user.name,
        ownerEmail: share.canvas.user.email,
      })),
    });
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
          select: boardSelect,
        });
      }
    );

    return NextResponse.json(
      { canvas: { ...canvas, permission: "owner" } },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof PlanLimitError) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }
    console.error("Error creating canvas:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// PUT /api/canvas → rename and/or save the Excalidraw scene (autosave target)
export async function PUT(request: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { id, title, content } = await request.json();
    if (!id) {
      return NextResponse.json({ message: "id is required" }, { status: 400 });
    }

    const access = await getCanvasAccess(id, sessionUserId);
    if ("error" in access)
      return NextResponse.json({ message: access.error }, { status: access.status });

    // The owner may rename and rewrite; a "write" grant may only rewrite the
    // scene; a "read" grant is refused here even if the client misbehaves.
    const wantsRename = typeof title === "string" && title.trim().length > 0;
    if (wantsRename && access.permission !== "owner") {
      return NextResponse.json(
        { message: "Only the owner can rename this board" },
        { status: 403 }
      );
    }
    if (content !== undefined && access.permission === "read") {
      return NextResponse.json(
        { message: "You do not have permission to edit this board" },
        { status: 403 }
      );
    }

    const data: Record<string, unknown> = {};
    if (wantsRename) {
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

// DELETE /api/canvas?id=... → delete the caller's board (owner only)
export async function DELETE(request: Request) {
  try {
    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) return unauthorized();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") ?? "";

    const access = await getCanvasAccess(id, sessionUserId);
    if ("error" in access)
      return NextResponse.json({ message: access.error }, { status: access.status });
    if (access.permission !== "owner") {
      return NextResponse.json(
        { message: "Only the owner can delete this board" },
        { status: 403 }
      );
    }

    await prisma.canvas.delete({ where: { id: access.canvas.id } });
    return NextResponse.json({ message: "Canvas deleted" });
  } catch (error: any) {
    console.error("Error deleting canvas:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
