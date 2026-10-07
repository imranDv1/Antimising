import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse, NextRequest } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function getPublicIdFromUrl(url: string) {
  const parts = url.split("/");
  const folderAndFile = parts.slice(-2).join("/");
  const publicId = folderAndFile.replace(/\.[^/.]+$/, "");
  return publicId;
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> } // 👈 هذا مهم
) {
  const { id } = await context.params; // 👈 يجب انتظار الـ Promise

  if (!id) {
    return NextResponse.json({ message: "Note ID is required" }, { status: 400 });
  }

  // 🔐 المصادقة والصلاحية: المالك فقط يمكنه حذف الملاحظة
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userIdFromSession = session?.user?.id;

  if (!userIdFromSession) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const note = await prisma.note.findUnique({ where: { id } });
    if (!note) {
      return NextResponse.json({ message: "Note not found" }, { status: 404 });
    }
    if (note.userId !== userIdFromSession) {
      return NextResponse.json(
        { message: "You do not own this note" },
        { status: 403 }
      );
    }

    const noteBody = await prisma.noteBody.findUnique({ where: { noteId: id } });

    if (noteBody?.images?.length) {
      for (const url of noteBody.images) {
        try {
          const publicId = getPublicIdFromUrl(url);
          await cloudinary.uploader.destroy(publicId);
        } catch (err) {
          console.error("Failed to delete image from Cloudinary:", url, err);
        }
      }
    }

    await prisma.noteBody.deleteMany({ where: { noteId: id } });
    await prisma.note.delete({ where: { id } });

    return NextResponse.json({ message: "Note and all images deleted successfully" });
  } catch (error) {
    return NextResponse.json({ message: "Failed to delete note: " + error }, { status: 500 });
  }
}
