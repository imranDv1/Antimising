import { NextResponse } from "next/server";
import { getSessionUserId, unauthorized } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { UTApi } from "uploadthing/server";

// UploadThing serves every public file from the app's own CDN subdomain and
// answers with `Access-Control-Allow-Origin: *` (verified against this token's
// bucket), so the browser can re-inline the image on the next board load.
const utapi = new UTApi();

// Excalidraw downscales on insert, so what reaches us is already resized —
// 8MB is headroom over its own 4MB source-file ceiling.
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return unauthorized();

    if (!(await rateLimit(`canvas-image:${userId}`, 60, 60_000))) {
      return NextResponse.json(
        { message: "Too many image uploads. Try again in a minute." },
        { status: 429 }
      );
    }

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { message: "file is required" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { message: "Only images can be uploaded" },
        { status: 415 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ message: "Image is too large" }, { status: 413 });
    }

    const result = await utapi.uploadFiles(file);
    if (result.error || !result.data) {
      console.error("UploadThing rejected a canvas image:", result.error);
      return NextResponse.json(
        { message: "Image upload failed" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      url: result.data.ufsUrl,
      key: result.data.key,
      name: result.data.name,
      size: result.data.size,
    });
  } catch (error) {
    console.error("Error uploading canvas image:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
