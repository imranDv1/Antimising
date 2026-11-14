import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// 📥 قائمة الملاحظات المشتركة معي + عدد غير المقروء منها
export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const userIdFromSession = session?.user?.id;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ message: "userId is required" }, { status: 400 });
    }

    if (userId !== userIdFromSession) {
      return NextResponse.json(
        { message: "This note is not yours" },
        { status: 401 }
      );
    }

    // استخدام خفيف للشريط الجانبي — العد فقط بدون سحب القائمة
    if (searchParams.get("countOnly") === "true") {
      const unreadCount = await prisma.noteShare.count({
        where: { userId, isRead: false },
      });
      return NextResponse.json({ unreadCount });
    }

    const [shares, unreadCount] = await Promise.all([
      prisma.noteShare.findMany({
        where: { userId },
        include: {
          note: {
            include: {
              user: { select: { name: true, email: true, image: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.noteShare.count({ where: { userId, isRead: false } }),
    ]);

    const notes = shares.map((row) => ({
      id: row.note.id,
      title: row.note.title,
      description: row.note.description,
      category: row.note.category,
      createdAt: row.note.createdAt,
      updatedAt: row.note.updatedAt,
      userId: row.note.userId,
      permission: row.permission,
      shareCount: 0,
      ownerName: row.note.user.name,
      ownerEmail: row.note.user.email,
      ownerImage: row.note.user.image,
      isRead: row.isRead,
    }));

    return NextResponse.json({ notes, unreadCount });
  } catch (error) {
    console.error("Error fetching shared notes:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// ✓ تعليم ملاحظة مشتركة كمقروءة — المستلم فقط (يمنع أي مستخدم آخر)
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const userIdFromSession = session?.user?.id;
    if (!userIdFromSession) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { noteId } = await request.json();
    if (!noteId) {
      return NextResponse.json({ message: "noteId is required" }, { status: 400 });
    }

    const updated = await prisma.noteShare.updateMany({
      where: { noteId, userId: userIdFromSession },
      data: { isRead: true },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { message: "This note is not shared with you" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking shared note as read:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// 🗑️ رفض مشاركة ملاحظة — المستلم فقط (يحذف الوصول الخاص به ولا يمس مالك الملاحظة)
export async function DELETE(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const userIdFromSession = session?.user?.id;
    if (!userIdFromSession) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("noteId") || "";

    if (!noteId) {
      return NextResponse.json({ message: "noteId is required" }, { status: 400 });
    }

    const removed = await prisma.$transaction(async (tx) => {
      const deleted = await tx.noteShare.deleteMany({
        where: { noteId, userId: userIdFromSession },
      });
      if (deleted.count === 0) return 0;
      // The note is no longer reachable, so don't keep it in favorites either.
      await tx.favoriteNote.deleteMany({
        where: { userId: userIdFromSession, noteId },
      });
      return deleted.count;
    });

    if (removed === 0) {
      return NextResponse.json(
        { message: "This note is not shared with you" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Share declined" });
  } catch (error) {
    console.error("Error declining shared note:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
