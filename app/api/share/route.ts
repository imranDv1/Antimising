import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

const PERMISSIONS = ["read", "write"] as const;
type SharePermission = (typeof PERMISSIONS)[number];

async function getSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user?.id ?? null;
}

// التحقق أن المستخدم الحالي هو مالك الملاحظة
async function getOwnedNote(noteId: string, userId: string) {
  if (!noteId) return { error: "noteId is required", status: 400 } as const;
  const note = await prisma.note.findUnique({ where: { id: noteId } });
  if (!note) return { error: "Note not found", status: 404 } as const;
  if (note.userId !== userId)
    return { error: "You do not own this note", status: 403 } as const;
  return { note } as const;
}

function isValidPermission(permission: unknown): permission is SharePermission {
  return (
    typeof permission === "string" && PERMISSIONS.includes(permission as SharePermission)
  );
}

function serializeShare(share: {
  id: string;
  permission: string;
  createdAt: Date;
  user: { id: string; name: string; email: string; image: string | null };
}) {
  return {
    id: share.id,
    permission: share.permission,
    createdAt: share.createdAt,
    user: {
      id: share.user.id,
      name: share.user.name,
      email: share.user.email,
      image: share.user.image,
    },
  };
}

// 📋 جلب قائمة المشاركين — المالك فقط
export async function GET(request: Request) {
  try {
    const userId = await getSessionUser();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("noteId") || "";

    const owned = await getOwnedNote(noteId, userId);
    if ("error" in owned) {
      return NextResponse.json({ message: owned.error }, { status: owned.status });
    }

    const shares = await prisma.noteShare.findMany({
      where: { noteId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ shares: shares.map(serializeShare) });
  } catch (error) {
    console.error("Error fetching shares:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// ➕ مشاركة ملاحظة — المالك فقط (upsert للتعامل مع التكرار بأمان)
export async function POST(request: Request) {
  try {
    const userId = await getSessionUser();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { noteId, userId: targetUserId, permission } = await request.json();

    const owned = await getOwnedNote(noteId ?? "", userId);
    if ("error" in owned) {
      return NextResponse.json({ message: owned.error }, { status: owned.status });
    }

    if (!targetUserId) {
      return NextResponse.json({ message: "userId is required" }, { status: 400 });
    }

    if (targetUserId === userId) {
      return NextResponse.json(
        { message: "You cannot share a note with yourself" },
        { status: 400 }
      );
    }

    if (!isValidPermission(permission)) {
      return NextResponse.json(
        { message: "Invalid permission. Use 'read' or 'write'" },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, image: true },
    });

    if (!target) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const share = await prisma.noteShare.upsert({
      where: { noteId_userId: { noteId, userId: targetUserId } },
      update: { permission },
      create: { noteId, userId: targetUserId, permission },
    });

    return NextResponse.json({
      share: { ...serializeShare({ ...share, user: target }) },
      message: "shared",
    });
  } catch (error) {
    console.error("Error sharing note:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// 🔄 تحديث الصلاحية (read ↔ write) — المالك فقط
export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUser();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { noteId, userId: targetUserId, permission } = await request.json();

    const owned = await getOwnedNote(noteId ?? "", userId);
    if ("error" in owned) {
      return NextResponse.json({ message: owned.error }, { status: owned.status });
    }

    if (!targetUserId) {
      return NextResponse.json({ message: "userId is required" }, { status: 400 });
    }

    if (!isValidPermission(permission)) {
      return NextResponse.json(
        { message: "Invalid permission. Use 'read' or 'write'" },
        { status: 400 }
      );
    }

    const existing = await prisma.noteShare.findUnique({
      where: { noteId_userId: { noteId, userId: targetUserId } },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "This user does not have access to the note" },
        { status: 404 }
      );
    }

    const updated = await prisma.noteShare.update({
      where: { noteId_userId: { noteId, userId: targetUserId } },
      data: { permission },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return NextResponse.json({
      share: serializeShare(updated),
      message: "updated",
    });
  } catch (error) {
    console.error("Error updating share permission:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// 🗑️ إزالة المشاركة — المالك فقط
export async function DELETE(request: Request) {
  try {
    const userId = await getSessionUser();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const noteId = searchParams.get("noteId") || "";
    const targetUserId = searchParams.get("userId") || "";

    const owned = await getOwnedNote(noteId, userId);
    if ("error" in owned) {
      return NextResponse.json({ message: owned.error }, { status: owned.status });
    }

    if (!targetUserId) {
      return NextResponse.json({ message: "userId is required" }, { status: 400 });
    }

    const deleted = await prisma.noteShare.deleteMany({
      where: { noteId, userId: targetUserId },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { message: "This user does not have access to the note" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Access removed" });
  } catch (error) {
    console.error("Error removing share:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}