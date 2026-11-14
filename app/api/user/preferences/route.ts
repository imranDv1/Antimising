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

// ⚙️ تفضيلات المشاركة — للمستخدم الحالي فقط
export async function GET() {
  try {
    const userId = await getSessionUser();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { allowSharing: true },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ allowSharing: user.allowSharing });
  } catch (error) {
    console.error("Error fetching user preferences:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// 🔄 تحديث تفضيلات المشاركة — للمستخدم الحالي فقط
export async function PATCH(request: Request) {
  try {
    const userId = await getSessionUser();
    if (!userId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const allowSharing = body?.allowSharing;

    if (typeof allowSharing !== "boolean") {
      return NextResponse.json(
        { message: "allowSharing must be true or false" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { allowSharing },
      select: { allowSharing: true },
    });

    return NextResponse.json({ allowSharing: updated.allowSharing });
  } catch (error) {
    console.error("Error updating user preferences:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
