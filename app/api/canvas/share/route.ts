import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

const PERMISSIONS = ["read", "write"] as const;
type SharePermission = (typeof PERMISSIONS)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function getSessionUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user?.id ?? null;
}

// Only the board owner may manage who else can open it.
async function getOwnedCanvas(canvasId: string, userId: string) {
  if (!canvasId) return { error: "canvasId is required", status: 400 } as const;
  const canvas = await prisma.canvas.findUnique({ where: { id: canvasId } });
  if (!canvas) return { error: "Board not found", status: 404 } as const;
  if (canvas.userId !== userId)
    return { error: "You do not own this board", status: 403 } as const;
  return { canvas } as const;
}

function isValidPermission(permission: unknown): permission is SharePermission {
  return (
    typeof permission === "string" &&
    PERMISSIONS.includes(permission as SharePermission)
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

// 📋 قائمة من يمكنهم فتح اللوحة — المالك فقط
export async function GET(request: Request) {
  try {
    const userId = await getSessionUser();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const canvasId = searchParams.get("canvasId") || "";

    const owned = await getOwnedCanvas(canvasId, userId);
    if ("error" in owned) {
      return NextResponse.json({ message: owned.error }, { status: owned.status });
    }

    const shares = await prisma.canvasShare.findMany({
      where: { canvasId },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ shares: shares.map(serializeShare) });
  } catch (error) {
    console.error("Error fetching board shares:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// ➕ مشاركة لوحة — المالك فقط (upsert للتعامل مع التكرار بأمان)
export async function POST(request: Request) {
  try {
    const userId = await getSessionUser();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { canvasId, email, permission } = await request.json();

    const owned = await getOwnedCanvas(canvasId ?? "", userId);
    if ("error" in owned) {
      return NextResponse.json({ message: owned.error }, { status: owned.status });
    }

    if (!isValidPermission(permission)) {
      return NextResponse.json(
        { message: "Invalid permission. Use 'read' or 'write'" },
        { status: 400 }
      );
    }

    // Exact email lookup only — no fuzzy/partial search over the user table.
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      return NextResponse.json(
        { message: "Enter a valid email address" },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        allowSharing: true,
      },
    });

    if (!target) {
      return NextResponse.json(
        { message: "No Rinsign account uses that email address" },
        { status: 404 }
      );
    }

    if (target.id === userId) {
      return NextResponse.json(
        { message: "You cannot share a board with yourself" },
        { status: 400 }
      );
    }

    if (!target.allowSharing) {
      return NextResponse.json(
        { message: `${target.name} isn't accepting shared boards right now` },
        { status: 403 }
      );
    }

    const share = await prisma.canvasShare.upsert({
      where: { canvasId_userId: { canvasId, userId: target.id } },
      update: { permission },
      create: { canvasId, userId: target.id, permission },
    });

    return NextResponse.json({
      share: serializeShare({ ...share, user: target }),
      message: "shared",
    });
  } catch (error) {
    console.error("Error sharing board:", error);
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

    const { canvasId, userId: targetUserId, permission } = await request.json();

    const owned = await getOwnedCanvas(canvasId ?? "", userId);
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

    const existing = await prisma.canvasShare.findUnique({
      where: { canvasId_userId: { canvasId, userId: targetUserId } },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "This user does not have access to the board" },
        { status: 404 }
      );
    }

    const updated = await prisma.canvasShare.update({
      where: { canvasId_userId: { canvasId, userId: targetUserId } },
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
    console.error("Error updating board share:", error);
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
    const canvasId = searchParams.get("canvasId") || "";
    const targetUserId = searchParams.get("userId") || "";

    const owned = await getOwnedCanvas(canvasId, userId);
    if ("error" in owned) {
      return NextResponse.json({ message: owned.error }, { status: owned.status });
    }

    if (!targetUserId) {
      return NextResponse.json({ message: "userId is required" }, { status: 400 });
    }

    const deleted = await prisma.canvasShare.deleteMany({
      where: { canvasId, userId: targetUserId },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { message: "This user does not have access to the board" },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: "Access removed" });
  } catch (error) {
    console.error("Removing board share:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
