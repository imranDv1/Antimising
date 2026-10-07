import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

// 📝 Support editing notes
export async function PUT(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userIdFromSession = session?.user?.id;

  const { id, title, description, category } = await request.json();

  if (!id) {
    return NextResponse.json({ message: "note id is required" }, { status: 400 });
  }
  // نعتمد على الجلسة فقط ولا نثق بالـ userId من العميل
  if (!userIdFromSession) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!title) {
    return NextResponse.json({ message: "please enter the title" }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ message: "please enter the description" }, { status: 400 });
  }
  if (!category) {
    return NextResponse.json({ message: "please enter the category" }, { status: 400 });
  }

  try {
    const note = await prisma.note.findUnique({ where: { id } });
    if (!note) {
      return NextResponse.json({ message: "Note not found" }, { status: 404 });
    }

    // 🔐 الصلاحية: المالك أو صاحب صلاحية "write" يمكنه تعديل البيانات الوصفية
    const canWrite =
      note.userId === userIdFromSession ||
      (await prisma.noteShare.findUnique({
        where: { noteId_userId: { noteId: id, userId: userIdFromSession } },
        select: { permission: true },
      }))?.permission === "write";

    if (!canWrite) {
      return NextResponse.json(
        { message: "You do not have permission to edit this note" },
        { status: 403 }
      );
    }

    const updated = await prisma.note.update({
      where: { id },
      data: {
        title,
        description,
        category,
      },
    });

    return NextResponse.json({ message: "note updated successfully", note: updated });
  } catch (error) {
    console.error("Error updating note:", error);
    return NextResponse.json("error updating note " + error, { status: 500 });
  }
}