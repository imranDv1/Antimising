import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

type CanvasDocumentWithFiles = {
  files?: Record<string, { dataURL?: string } | null> | null;
};

function isUploadThingHost(hostname: string) {
  const host = hostname.toLowerCase();
  return (
    host.endsWith(".ufs.sh") ||
    host === "utfs.io" ||
    host.endsWith(".utfs.io")
  );
}

/** Every remote image URL referenced by a saved canvas scene. */
export function extractRemoteCanvasImageUrls(document: unknown): string[] {
  if (!document || typeof document !== "object") return [];

  const files = (document as CanvasDocumentWithFiles).files;
  if (!files) return [];

  const urls = new Set<string>();
  for (const file of Object.values(files)) {
    const url = file?.dataURL;
    if (typeof url === "string" && /^https?:\/\//i.test(url)) urls.add(url);
  }
  return [...urls];
}

/** URLs that existed in the previous scene but are gone from the next one. */
export function findRemovedCanvasImageUrls(
  previous: unknown,
  next: unknown
): string[] {
  const nextUrls = new Set(extractRemoteCanvasImageUrls(next));
  return extractRemoteCanvasImageUrls(previous).filter(
    (url) => !nextUrls.has(url)
  );
}

// UploadThing keys are the last path segment: https://APP_ID.ufs.sh/f/<key>
function uploadThingKeyFromUrl(url: string): string | null {
  try {
    const { hostname, pathname } = new URL(url);
    if (!isUploadThingHost(hostname)) return null;

    const segments = pathname.split("/").filter(Boolean);
    const key = segments.at(-1);
    return key ? decodeURIComponent(key) : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort storage cleanup. Only UploadThing files are touched; externally
 * hosted images are never deleted. Failures are logged, never thrown.
 */
export async function deleteCanvasImages(urls: string[]): Promise<void> {
  const keys = [
    ...new Set(
      urls
        .map(uploadThingKeyFromUrl)
        .filter((key): key is string => Boolean(key))
    ),
  ];

  if (keys.length === 0) return;

  try {
    const result = await utapi.deleteFiles(keys);
    if (!result.success) {
      console.error(
        "UploadThing did not delete every removed canvas image",
        result
      );
    }
  } catch (err) {
    console.error("Failed to delete canvas images from UploadThing:", err);
  }
}
