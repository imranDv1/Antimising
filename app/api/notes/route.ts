import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlanLimits } from "@/lib/limits";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

export async function GET(request: Request) {
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

  const rawPage = Number(searchParams.get("page") ?? 1);
  const rawLimit = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(rawLimit)))
    : DEFAULT_LIMIT;
  const skip = (page - 1) * limit;

  try {
    // 🧾 ملاحظاتي (المملوكة) — المفضلة تظهر أولاً، كل صفحة تُجلب عند التمرير
    // 🔗 الملاحظات المشتركة معي تُجلب كاملة في أول طلب (تعتمد على orderBy fav first)
    const [limits, ownedNotes, totalCount, sharedRows] = await Promise.all([
      getPlanLimits(userId),
      prisma.note.findMany({
        where: { userId },
        orderBy: [
          { favorites: { _count: "desc" } },
          { updatedAt: "desc" },
        ],
        skip,
        take: limit,
        include: { _count: { select: { shares: true } } },
      }),
      prisma.note.count({ where: { userId } }),
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
    ]);

    const mine = ownedNotes.map((note) => ({
      id: note.id,
      title: note.title,
      description: note.description,
      category: note.category,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      userId: note.userId,
      permission: "owner",
      shareCount: note._count.shares,
    }));

    const shared = sharedRows.map((row) => ({
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

    return NextResponse.json({
      mine,
      shared,
      totalCount,
      page,
      limit,
      noteLimit: limits.noteLimit,
      hasMore: skip + ownedNotes.length < totalCount,
    });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}