import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// 🔎 البحث عن مستخدمين مسجلين بالبريد الإلكتروني (مستخدم واحد فقط)
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { users: [], message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { query } = await request.json();
    const q = typeof query === "string" ? query.trim() : "";

    if (q.length < 2) {
      return NextResponse.json({ users: [] });
    }

    const users = await prisma.user.findMany({
      where: {
        id: { not: session.user.id },
        OR: [
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
      take: 8,
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error searching users:", error);
    return NextResponse.json(
      { users: [], message: "Internal Server Error" },
      { status: 500 }
    );
  }
}