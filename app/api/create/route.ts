import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: Request) {
  const { title, description, category, userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ message: "userId are required" });
  }

  // 🔐 نعتمد على الجلسة فقط ولا نثق بالـ userId من العميل
  const session = await auth.api.getSession({ headers: await headers() });
  const userIdFromSession = session?.user?.id;
  if (!userIdFromSession || userId !== userIdFromSession) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!title) {
    return NextResponse.json({ message: "please enter the title" });
  }
  if (!description) {
    return NextResponse.json({ message: "please enter the description" });
  }
  if (!category) {
    return NextResponse.json({ message: "please enter the category" });
  }

  try {
    await prisma.note.create({
      data: {
        id: uuidv4(),
        title,
        description,
        category,
        userId,
      },
    });

    return NextResponse.json("note create successfuly");
  } catch (error) {
    return NextResponse.json("error create note" + error, { status: 500 });
  }
}

// 📝 Support editing notes (legacy — hardened with authorization)
export async function PUT(request: Request) {
  const { noteId, id, title, description, category } = await request.json();

  const targetId = noteId || id;

  if (!targetId) {
    return NextResponse.json({ message: "note id is required" });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userIdFromSession = session?.user?.id;
  if (!userIdFromSession) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!title) {
    return NextResponse.json({ message: "please enter the title" });
  }
  if (!description) {
    return NextResponse.json({ message: "please enter the description" });
  }
  if (!category) {
    return NextResponse.json({ message: "please enter the category" });
  }

  try {
    const note = await prisma.note.findUnique({ where: { id: targetId } });
    if (!note) {
      return NextResponse.json({ message: "Note not found" }, { status: 404 });
    }

    const canWrite =
      note.userId === userIdFromSession ||
      (await prisma.noteShare.findUnique({
        where: { noteId_userId: { noteId: targetId, userId: userIdFromSession } },
        select: { permission: true },
      }))?.permission === "write";

    if (!canWrite) {
      return NextResponse.json(
        { message: "You do not have permission to edit this note" },
        { status: 403 }
      );
    }

    const updated = await prisma.note.update({
      where: { id: targetId },
      data: {
        title,
        description,
        category,
      },
    });

    return NextResponse.json({ message: "note updated successfully", note: updated });
  } catch (error) {
    return NextResponse.json("error updating note " + error, { status: 500 });
  }
}