import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { decryptNoteBody } from "@/lib/note-encryption";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const userIdFromSession = session?.user?.id;

    const { noteId, userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "userId is required" },
        { status: 400 }
      );
    }
    if (!noteId) {
      return NextResponse.json(
        { success: false, message: "noteId is required" },
        { status: 400 }
      );
    }

    // لا نثق بالـ userId القادم من العميل — نستخدم الجلسة فقط
    if (userId !== userIdFromSession) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const note = await prisma.note.findUnique({
      where: { id: noteId },
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { shares: true } },
      },
    });

    if (!note) {
      return NextResponse.json(
        { success: false, message: "Note not found" },
        { status: 404 }
      );
    }

    // الصلاحية: المالك أو صاحب المشاركة (قراءة/كتابة)
    let permission: "owner" | "read" | "write" | null = null;

    if (note.userId === userIdFromSession) {
      permission = "owner";
    } else {
      const share = await prisma.noteShare.findUnique({
        where: { noteId_userId: { noteId, userId: userIdFromSession! } },
      });
      if (share) permission = share.permission as "read" | "write";
    }

    if (!permission) {
      return NextResponse.json(
        { success: false, message: "You do not have access to this note" },
        { status: 403 }
      );
    }

    const notebody = await prisma.noteBody.findUnique({
      where: { noteId },
    });

    // 🔒 فك تشفير المحتوى على الخادم — لا نرسل أبدًا النص المشفر أو المفتاح للعميل
    const decrypted = decryptNoteBody(notebody?.contentEnc ?? null);

    return NextResponse.json({
      success: true,
      notebody: notebody
        ? {
            id: notebody.id,
            content: decrypted.content ?? null,
            links: decrypted.links ?? [],
            images: notebody.images,
          }
        : null,
      noteTitle: note.title,
      permission,
      isOwner: permission === "owner",
      shareCount: note._count.shares,
      ownerName: note.user.name,
      ownerEmail: note.user.email,
    });
  } catch (error) {
    console.error("Error fetching note body:", error);
    return NextResponse.json(
      { success: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}