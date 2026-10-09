"use client";

import { useEffect, useRef, useState } from "react";
import {
  Excalidraw,
  getDataURL,
  getSceneVersion,
  serializeAsJSON,
  useHandleLibrary,
} from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  DataURL,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { LibraryPersistenceAdapter } from "@excalidraw/excalidraw/data/library";
import { Loader2 } from "lucide-react";
import "@excalidraw/excalidraw/index.css";

export type CanvasDocument = {
  elements: readonly ExcalidrawElement[];
  appState: Readonly<Partial<AppState>>;
  files: BinaryFiles;
};

type ExcalidrawEditorProps = {
  /** The board this editor instance belongs to — reported back on every save
   *  so a late flush (unmount) can never write one board's content into another. */
  boardId: string;
  initialDocument: CanvasDocument | null;
  /** Called ~1s after the user's last change, and on unmount (best effort). */
  onDocumentChange: (
    boardId: string,
    document: CanvasDocument
  ) => void | Promise<void>;
  /** Boards shared with a "read" grant open in view mode and never save. */
  readOnly?: boolean;
};

const SAVE_DEBOUNCE_MS = 1000;

// Imported shape libraries (from libraries.excalidraw.com) are kept per browser
// so they survive reloads without a server round-trip.
const LIBRARY_STORAGE_KEY = "rivorea:excalidraw-library";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
  "image/avif": "avif",
};

const libraryAdapter: LibraryPersistenceAdapter = {
  load: async () => {
    try {
      const raw = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
      return raw ? { libraryItems: JSON.parse(raw) } : null;
    } catch {
      return null;
    }
  },
  save: async ({ libraryItems }) => {
    try {
      window.localStorage.setItem(
        LIBRARY_STORAGE_KEY,
        JSON.stringify(libraryItems)
      );
    } catch {
      // Best effort — ignore quota/serialization errors.
    }
  },
};

// Only the persisted ExportState fields matter; this keeps viewport-only
// changes (scroll/zoom/selection) from triggering pointless autosaves.
function contentSignature(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles
) {
  const filesSig = Object.keys(files)
    .sort()
    .map((id) => `${id}:${files[id]?.dataURL?.length ?? 0}`)
    .join(",");
  return [
    getSceneVersion(elements),
    appState.viewBackgroundColor,
    appState.gridModeEnabled,
    appState.gridSize,
    appState.gridStep,
    filesSig,
  ].join("|");
}

function hasRemoteFiles(document: CanvasDocument | null): boolean {
  return Object.values(document?.files ?? {}).some(
    (file) => !!file && !file.dataURL.startsWith("data:")
  );
}

// A deleted image must not keep its payload (or its CDN object) alive.
function collectReferencedFiles(
  elements: readonly ExcalidrawElement[],
  files: BinaryFiles
): BinaryFiles {
  const referenced: BinaryFiles = {};
  for (const element of elements) {
    if (element.isDeleted) continue;
    if (!("fileId" in element)) continue;
    const fileId = (element as { fileId?: string | null }).fileId;
    if (!fileId) continue;
    const file = files[fileId];
    if (file) referenced[fileId] = file;
  }
  return referenced;
}

async function uploadToUploadThing(file: { dataURL: string }): Promise<string> {
  const source = await fetch(file.dataURL);
  if (!source.ok) throw new Error("Could not read the image");
  const blob = await source.blob();

  const form = new FormData();
  const mime = blob.type || "image/png";
  form.append(
    "file",
    new File([blob], `canvas-${Date.now()}.${EXTENSION_BY_MIME[mime] ?? "png"}`, {
      type: mime,
    })
  );

  const response = await fetch("/api/canvas/upload", {
    method: "POST",
    body: form,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || typeof data?.url !== "string") {
    throw new Error(data?.message || "Image upload failed");
  }
  return data.url;
}

export default function ExcalidrawEditor({
  boardId,
  initialDocument,
  onDocumentChange,
  readOnly = false,
}: ExcalidrawEditorProps) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const signatureRef = useRef<string | null>(null);
  const onChangeRef = useRef(onDocumentChange);
  onChangeRef.current = onDocumentChange;
  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;

  // fileId -> CDN URL. Seeded when a saved board is opened (so a round trip
  // never re-uploads), then grown as new images land on UploadThing. Typed as
  // DataURL only because that is what Excalidraw's BinaryFileData expects to
  // see in `dataURL` — the values here are remote URLs.
  const remoteUrlRef = useRef<Map<string, DataURL>>(new Map());
  // fileId -> in-flight upload, so a burst of onChange events uploads once.
  const uploadsRef = useRef<Map<string, Promise<void>>>(new Map());
  const failedUploadsRef = useRef<Set<string>>(new Set());

  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI | null>(null);

  const [preparedDocument, setPreparedDocument] =
    useState<CanvasDocument | null>(initialDocument);
  const [inlining, setInlining] = useState(() => hasRemoteFiles(initialDocument));

  // Excalidraw never sets `crossOrigin` on its image loader, so a cross-origin
  // dataURL would taint every canvas it touches (export, insert-preview, colour
  // sampling) and throw SecurityError. Saved boards therefore arrive as CDN
  // URLs; re-inline them before the editor ever sees the scene.
  useEffect(() => {
    let cancelled = false;
    const document = initialDocument;
    const remoteIds = Object.entries(document?.files ?? {})
      .filter(([, file]) => !!file && !file.dataURL.startsWith("data:"))
      .map(([id]) => id);

    if (!document || remoteIds.length === 0) {
      remoteUrlRef.current = new Map();
      setPreparedDocument(document);
      setInlining(false);
      return;
    }

    (async () => {
      const files: BinaryFiles = { ...document.files };
      const known = new Map<string, DataURL>();

      await Promise.all(
        remoteIds.map(async (id) => {
          const file = files[id];
          if (!file) return;
          known.set(id, file.dataURL);
          try {
            const response = await fetch(file.dataURL, { mode: "cors" });
            if (!response.ok) throw new Error(String(response.status));
            files[id] = {
              ...file,
              dataURL: await getDataURL(await response.blob()),
            };
          } catch (error) {
            // Fall back to the CDN URL — it still renders, it just can't be
            // read back out of a canvas.
            console.error("Canvas image could not be re-inlined:", error);
          }
        })
      );

      if (cancelled) return;
      remoteUrlRef.current = known;
      setPreparedDocument({ ...document, files });
      setInlining(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [initialDocument]);

  // Handles `#addLibrary` links from libraries.excalidraw.com (and other
  // allowed hosts) and persists the shapes library for the browser.
  useHandleLibrary({ excalidrawAPI, adapter: libraryAdapter });

  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
      ? "dark"
      : "light"
  );

  // Keep Excalidraw's theme in sync with the app's dark mode.
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setTheme(
        document.documentElement.classList.contains("dark") ? "dark" : "light"
      )
    );
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const ensureUploaded = (
    id: string,
    file: { dataURL: string }
  ): Promise<void> => {
    if (remoteUrlRef.current.has(id)) return Promise.resolve();
    if (failedUploadsRef.current.has(id)) return Promise.resolve();
    const inFlight = uploadsRef.current.get(id);
    if (inFlight) return inFlight;

    const task = uploadToUploadThing(file)
      .then((url) => {
        remoteUrlRef.current.set(id, url as DataURL);
      })
      .catch((error) => {
        // One attempt per file: the inline data: URL stays in the scene so the
        // image is never lost, it just keeps living in the database.
        failedUploadsRef.current.add(id);
        console.error("Canvas image upload failed:", error);
      })
      .finally(() => {
        uploadsRef.current.delete(id);
      });

    uploadsRef.current.set(id, task);
    return task;
  };

  const buildDocument = (): CanvasDocument | null => {
    const api = apiRef.current;
    if (!api) return null;
    const elements = api.getSceneElements();
    const files = collectReferencedFiles(elements, api.getFiles());
    // serializeAsJSON(..., "database") deliberately emits `files: undefined`,
    // which is why board images used to vanish on reload — attach them here.
    const parsed = JSON.parse(
      serializeAsJSON(elements, api.getAppState(), files, "database")
    ) as CanvasDocument;
    return { ...parsed, files };
  };

  // Swaps every known image for its CDN URL so the encrypted payload holds a
  // few dozen bytes per image instead of base64.
  const withRemoteUrls = (document: CanvasDocument): CanvasDocument => {
    const entries = Object.entries(document.files ?? {});
    if (entries.length === 0) return document;

    let substituted = false;
    const files: BinaryFiles = {};
    for (const [id, file] of entries) {
      const remote = file ? remoteUrlRef.current.get(id) : undefined;
      if (file && remote && file.dataURL !== remote) {
        files[id] = { ...file, dataURL: remote };
        substituted = true;
      } else if (file) {
        files[id] = file;
      }
    }
    return substituted ? { ...document, files } : document;
  };

  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (readOnlyRef.current || !dirtyRef.current) return;

    try {
      const document = buildDocument();
      if (!document) return;
      dirtyRef.current = false;

      const stored = withRemoteUrls(document);
      const files = stored.files ?? {};
      const pending = Object.keys(files).filter(
        (id) => files[id]?.dataURL?.startsWith("data:")
      );

      // Emit straight away — a scene saved as inline data is always valid, so
      // a slow upload can never hold an edit hostage.
      const saved = Promise.resolve(
        onChangeRef.current(boardIdRef.current, stored)
      ).catch(() => {});

      if (pending.length === 0) return;

      void Promise.allSettled(
        pending.map((id) => ensureUploaded(id, files[id]))
      )
        .then(() => saved)
        .then(() => {
          const landed = pending.some((id) => remoteUrlRef.current.has(id));
          if (!landed) return;
          dirtyRef.current = true;
          flush();
        });
    } catch {
      // Editor already torn down — nothing to flush.
    }
  };

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles
  ) => {
    if (readOnlyRef.current) return;

    const signature = contentSignature(elements, appState, files);
    // First callback after mount records the restored state as the baseline.
    if (signatureRef.current === null) {
      signatureRef.current = signature;
      return;
    }
    if (signature === signatureRef.current) return;
    signatureRef.current = signature;

    // Warm the CDN URL the moment a local image shows up, so the flush below
    // usually has it ready instead of waiting on the network.
    for (const [id, file] of Object.entries(files)) {
      if (file?.dataURL?.startsWith("data:")) void ensureUploaded(id, file);
    }

    dirtyRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flush();
    }, SAVE_DEBOUNCE_MS);
  };

  const initialData =
    preparedDocument && Array.isArray(preparedDocument.elements)
      ? {
          elements: preparedDocument.elements,
          appState: preparedDocument.appState,
          files: preparedDocument.files,
          scrollToContent: true,
        }
      : null;

  if (inlining) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <Excalidraw
        initialData={initialData}
        theme={theme}
        viewModeEnabled={readOnly}
        excalidrawAPI={(api) => {
          apiRef.current = api;
          setExcalidrawAPI(api);
        }}
        onChange={handleChange}
      />
    </div>
  );
}
