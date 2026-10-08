/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { encryptNoteBody } from "@/lib/note-encryption";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getPlanLimits } from "@/lib/limits";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper: extract all link URLs from Tiptap JSON
function extractLinksFromContent(content: any): string[] {
  const urls: string[] = [];
  function traverse(node: any) {
    if (!node) return;
    if (node.type === "link" && node.attrs?.href) {
      urls.push(node.attrs.href);
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  }
  traverse(content);
  return Array.from(new Set(urls));
}

// Helper: extract all image srcs from Tiptap JSON
function extractImageSrcsFromContent(content: any): string[] {
  const srcs: string[] = [];
  function traverse(node: any) {
    if (!node) return;
    if (node.type === "image" && node.attrs?.src) {
      srcs.push(node.attrs.src);
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  }
  traverse(content);
  return srcs;
}

// Helper: replace image src in Tiptap content with Cloudinary URLs (in order)
function replaceImageSrcs(node: any, newImageUrls: string[]): any {
  let imageIndex = 0;
  function traverse(n: any): any {
    if (!n) return n;
    if (n.type === "image") {
      // Only replace if src starts with "blob:" (i.e. new upload)
      if (n.attrs?.src && n.attrs.src.startsWith("blob:") && newImageUrls[imageIndex]) {
        n.attrs.src = newImageUrls[imageIndex];
        imageIndex += 1;
      }
    }
    if (Array.isArray(n.content)) {
      n.content = n.content.map(traverse);
    }
    return n;
  }
  return traverse(node);
}

// Helper: remove nodes of type "imageUpload" from content
function removeImageUploadNodes(node: any): any {
  if (!node) return node;
  if (Array.isArray(node.content)) {
    node.content = node.content
      .map(removeImageUploadNodes)
      .filter((child: any) => child.type !== "imageUpload");
  }
  return node;
}

// Helper: extract Cloudinary public_id from secure_url
function getPublicIdFromUrl(url: string) {
  // works for images uploaded to a folder (e.g., notes/...)
  const matches = url.match(/\/(?:v\d+\/)?([^/.]+(?:\/[^/.]+)*)\.[^/.]+$/); // matches "notes/abc123"
  if (matches && matches[1]) {
    return matches[1];
  }
  return null;
}

// Helper: count text characters across Tiptap JSON
function countTextChars(content: any): number {
  let total = 0;
  const traverse = (node: any) => {
    if (!node) return;
    if (node.type === "text" && typeof node.text === "string") {
      total += node.text.length;
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(traverse);
    }
  };
  traverse(content);
  return total;
}

export async function POST(request: Request) {
  try {
    // 🔐 المصادقة: نعتمد على الجلسة فقط، ولا نثق بأي معرف من العميل
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    const userIdFromSession = session?.user?.id;

    if (!userIdFromSession) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const noteId = formData.get("noteId") as string;
    const contentStr = formData.get("content") as string;
    const files = formData.getAll("images") as File[];

    if (!noteId || !contentStr) {
      return NextResponse.json(
        { success: false, message: "noteId and content are required" },
        { status: 400 }
      );
    }

    // 🔐 الصلاحية: المالك أو "write" فقط يمكنهم الحفظ
    const note = await prisma.note.findUnique({ where: { id: noteId } });
    if (!note) {
      return NextResponse.json(
        { success: false, message: "Note not found" },
        { status: 404 }
      );
    }
    const canWrite =
      note.userId === userIdFromSession ||
      (await prisma.noteShare.findUnique({
        where: { noteId_userId: { noteId, userId: userIdFromSession } },
        select: { permission: true },
      }))?.permission === "write";

    if (!canWrite) {
      return NextResponse.json(
        { success: false, message: "You do not have permission to edit this note" },
        { status: 403 }
      );
    }

    // Parse content JSON
    let content: any;
    try {
      content = JSON.parse(contentStr);
    } catch {
      return NextResponse.json({ success: false, error: "Invalid content JSON" }, { status: 400 });
    }

    // Remove any "imageUpload" nodes
    content = removeImageUploadNodes(content);

    // Check if content is effectively empty
    const isEmptyContent =
      content.type === "doc" &&
      Array.isArray(content.content) &&
      content.content.length === 1 &&
      content.content[0].type === "paragraph" &&
      (
        !content.content[0].content || 
        content.content[0].content.every((c: any) =>
          c.type === "text" && (!c.text || c.text.trim() === "")
        )
      );

    if (isEmptyContent) {
      content = null;
    }

    // Plan limits are enforced server-side from the submitted content. The
    // strictest applicable limit (note owner vs the authenticated editor) is
    // used, so a shared editor can neither exceed the owner's quota nor have
    // their own plan ignored.
    const ownerLimits = await getPlanLimits(note.userId);
    let maxChars = ownerLimits.maxChars;
    let maxImages = ownerLimits.imagesPerNote;
    if (userIdFromSession !== note.userId) {
      const editorLimits = await getPlanLimits(userIdFromSession);
      maxChars = Math.min(maxChars, editorLimits.maxChars);
      maxImages = Math.min(maxImages, editorLimits.imagesPerNote);
    }

    if (content) {
      const imageCount = extractImageSrcsFromContent(content).length;
      if (imageCount > maxImages) {
        return NextResponse.json(
          {
            success: false,
            message: `Your plan allows at most ${maxImages} images per note.`,
          },
          { status: 403 }
        );
      }

      const charCount = countTextChars(content);
      if (charCount > maxChars) {
        return NextResponse.json(
          {
            success: false,
            message: `Your plan allows at most ${maxChars} characters per note.`,
          },
          { status: 403 }
        );
      }
    }

    // Extract external links
    const links = content ? extractLinksFromContent(content) : [];

    // Extract all image srcs from new content (before replacement)
    const allImageSrcs = content ? extractImageSrcsFromContent(content) : [];

    // Find which images are new (blob:), and need to be uploaded
    const blobIndexes = allImageSrcs
      .map((src, idx) => src.startsWith("blob:") ? idx : -1)
      .filter(idx => idx !== -1);

    // Upload new images to Cloudinary and get their URLs
    const newImageUrls: string[] = [];
    for (let i = 0; i < blobIndexes.length; ++i) {
      const file = files[i]; // Order of files must match order of blob: in content!
      const buffer = Buffer.from(await file.arrayBuffer());
      const uploaded = await new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "notes" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(buffer);
      });
      newImageUrls.push(uploaded.secure_url);
    }

    // Replace only "blob:" image srcs in content with Cloudinary URLs
    if (content && newImageUrls.length > 0) {
      content = replaceImageSrcs(content, newImageUrls);
    }

    // After replacement, get all final image URLs in content (should all be proper URLs)
    const finalImageUrlsInContent = content ? extractImageSrcsFromContent(content) : [];

    // Fetch existing noteBody
    const existingBody = await prisma.noteBody.findUnique({ where: { noteId } });

    // Determine which old images were removed from content
    const oldImages = existingBody?.images || [];
    const removedImages = oldImages.filter(
      url => !finalImageUrlsInContent.includes(url)
    );

    // Delete removed images from Cloudinary
    for (const url of removedImages) {
      try {
        const publicId = getPublicIdFromUrl(url);
        if (publicId) await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error("Failed to delete image from Cloudinary:", url, err);
      }
    }

    // Save only images that remain referenced in content
    const finalImages = finalImageUrlsInContent;

    // 🔒 تشفير المحتوى قبل الحفظ — لا تُخزَّن أبدًا بيانات النص الصريح في قاعدة البيانات
    const encryptedPayload = encryptNoteBody(content, links);

    // Save or update NoteBody (only the encrypted payload, never plaintext)
    if (existingBody) {
      await prisma.noteBody.update({
        where: { noteId },
        data: { contentEnc: encryptedPayload, images: finalImages },
      });
    } else {
      await prisma.noteBody.create({
        data: { noteId, contentEnc: encryptedPayload, images: finalImages },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ success: false, error: err.message });
  }
}