"use client";

import { useEffect, useRef } from "react";
import {
  Tldraw,
  getSnapshot,
  loadSnapshot,
  type Editor,
} from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";

export type CanvasDocument = ReturnType<typeof getSnapshot>["document"];

type TldrawEditorProps = {
  /** The board this editor instance belongs to — reported back on every save
   *  so a late flush (unmount) can never write into a different board. */
  boardId: string;
  initialDocument: CanvasDocument | null;
  /** Called ~1s after the user's last change, and on unmount (best effort). */
  onDocumentChange: (boardId: string, document: CanvasDocument) => void;
};

const SAVE_DEBOUNCE_MS = 1000;

export default function TldrawEditor({
  boardId,
  initialDocument,
  onDocumentChange,
}: TldrawEditorProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onDocumentChange);
  onChangeRef.current = onDocumentChange;
  const boardIdRef = useRef(boardId);
  boardIdRef.current = boardId;

  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current) return;
    const editor = editorRef.current;
    if (!editor) return;
    try {
      dirtyRef.current = false;
      const snapshot = getSnapshot(editor.store);
      onChangeRef.current(boardIdRef.current, snapshot.document);
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
  }, []);

  const handleMount = (editor: Editor) => {
    editorRef.current = editor;

    // Restore the board saved on the server (session/camera state stays local).
    if (initialDocument) {
      try {
        loadSnapshot(editor.store, { document: initialDocument });
      } catch (err) {
        console.error("Failed to load canvas snapshot:", err);
      }
    }

    // Keep tldraw's UI in sync with the app's dark mode.
    const applyTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      editor.user.updateUserPreferences({
        colorScheme: isDark ? "dark" : "light",
      });
    };
    applyTheme();
    const themeObserver = new MutationObserver(applyTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    editor.store.listen(
      () => {
        dirtyRef.current = true;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          if (!dirtyRef.current) return;
          try {
            dirtyRef.current = false;
            const snapshot = getSnapshot(editor.store);
            onChangeRef.current(boardIdRef.current, snapshot.document);
          } catch {
            // ignore — next change will retry
          }
        }, SAVE_DEBOUNCE_MS);
      },
      { source: "user", scope: "document" }
    );
  };

  return (
    <div className="relative h-full w-full [&_.tl-container]:h-full">
      <Tldraw onMount={handleMount} />
    </div>
  );
}
