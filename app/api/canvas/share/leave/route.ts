import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

async function getSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user?.id ?? null;
}

// 🗑️ رفض مشاركة لوحة — المستلم فقط (يحذف الوصول الخاص به ولا يمس مالك اللوحة)
export async function DELETE(request: Request) {
  try {
    const userId = await getSessionUser();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const canvasId = searchParams.get("canvasId") || "";

    if (!canvasId) {
      return NextResponse.json(
        { message: "canvasId is required" },
        { status: 400 }
      );
    }

    const canvas = await prisma.canvas.findUnique({
      where: { id: canvasId },
      select: { userId: true },
    });

    if (!canvas) {
      return NextResponse.json({ message: "Board not found" }, { status: 404 });
    }

    if (canvas.userId === userId) {
      return NextResponse.json(
        { message: "You own this board — delete it instead of leaving it" },
        { status: 400 }
      );
    }

    const removed = await prisma.$transaction(async (tx) => {
      const deleted = await tx.canvasShare.deleteMany({
        where: { canvasId, userId },
      });
      if (deleted.count === 0) return 0;
      // The board is no longer reachable, so don't keep it in favorites either.
      await tx.favoriteCanvas.deleteMany({
        where: { userId, canvasId },
      });
      return deleted.count;
    });

    if (removed === 0) {
      return NextResponse.json(
        { message: "This board is not shared with you" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Share declined" });
  } catch (error) {
    console.error("Error declining shared board:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
