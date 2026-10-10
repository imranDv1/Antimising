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

export async function POST(request: NextRequest) {
  let body: { ids?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === "string")
    : [];

  if (ids.length === 0) {
    return NextResponse.json(
      { message: "Note IDs are required" },
      { status: 400 }
    );
  }

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  const userIdFromSession = session?.user?.id;

  if (!userIdFromSession) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    // Only the owner of each note may delete it; shared notes are ignored.
    const notes = await prisma.note.findMany({
      where: { id: { in: ids }, userId: userIdFromSession },
    });

    if (notes.length === 0) {
      return NextResponse.json({ message: "Notes not found" }, { status: 404 });
    }

    const noteIds = notes.map((n) => n.id);

    const noteBodies = await prisma.noteBody.findMany({
      where: { noteId: { in: noteIds } },
    });

    for (const noteBody of noteBodies) {
      if (noteBody.images?.length) {
        for (const url of noteBody.images) {
          try {
            const publicId = getPublicIdFromUrl(url);
            await cloudinary.uploader.destroy(publicId);
          } catch (err) {
            console.error("Failed to delete image from Cloudinary:", url, err);
          }
        }
      }
    }

    await prisma.noteBody.deleteMany({ where: { noteId: { in: noteIds } } });
    await prisma.note.deleteMany({ where: { id: { in: noteIds } } });

    return NextResponse.json({
      deleted: notes.length,
      message: `Deleted ${notes.length} note${notes.length === 1 ? "" : "s"}`,
    });
  } catch (error) {
    return NextResponse.json(
      { message: "Failed to delete notes: " + error },
      { status: 500 }
    );
  }
}