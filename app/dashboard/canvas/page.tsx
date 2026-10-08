"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Check,
  Loader2,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { CanvasDocument } from "@/components/canvas/tldraw-editor";

const TldrawEditor = dynamic(
  () => import("@/components/canvas/tldraw-editor"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

type CanvasMeta = {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
};

type SaveStatus = "saved" | "saving" | "error";

export default function CanvasPage() {
  const [canvases, setCanvases] = useState<CanvasMeta[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDoc, setActiveDoc] = useState<CanvasDocument | null>(null);
  const [docLoading, setDocLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [renameValue, setRenameValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const saveSeqRef = useRef(0);
  const activeTitleRef = useRef("");
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Keep state in sync with Esc / browser exit as well as our button.
  useEffect(() => {
    const onFullscreenChange = () =>
      setIsFullscreen(
        document.fullscreenElement === canvasContainerRef.current
      );
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await canvasContainerRef.current?.requestFullscreen();
      }
    } catch {
      toast.error("Fullscreen is not available in this browser");
    }
  };

  const selectBoard = useCallback(async (id: string) => {
    setDocLoading(true);
    setActiveId(null);
    setActiveDoc(null);
    try {
      const res = await fetch(`/api/canvas?id=${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load board");
      setActiveId(data.canvas.id);
      setRenameValue(data.canvas.title);
      activeTitleRef.current = data.canvas.title;
      setActiveDoc(data.canvas.document ?? null);
      setSaveStatus("saved");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load board"
      );
    } finally {
      setDocLoading(false);
    }
  }, []);

  const createBoard = useCallback(
    async (selectAfter = true) => {
      setCreating(true);
      try {
        const res = await fetch("/api/canvas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to create board");
        setCanvases((prev) => [data.canvas, ...prev]);
        if (selectAfter) await selectBoard(data.canvas.id);
        toast.success("Board created");
        return data.canvas as CanvasMeta;
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to create board"
        );
        return null;
      } finally {
        setCreating(false);
      }
    },
    [selectBoard]
  );

  // Initial load: fetch boards, auto-create the first one if none exist.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/canvas");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to load boards");
        const list: CanvasMeta[] = data.canvases ?? [];
        setCanvases(list);
        if (list.length > 0) {
          await selectBoard(list[0].id);
        } else {
          await createBoard(true);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load boards"
        );
      } finally {
        setListLoading(false);
        setDocLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave target — receives the board id from the editor itself so a
  // late flush can never write one board's content into another.
  const handleDocumentChange = useCallback(
    async (boardId: string, document: CanvasDocument) => {
      const seq = ++saveSeqRef.current;
      setSaveStatus("saving");
      try {
        const res = await fetch("/api/canvas", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: boardId, content: document }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.message || "Save failed");
        }
        if (seq === saveSeqRef.current) setSaveStatus("saved");
      } catch {
        if (seq === saveSeqRef.current) {
          setSaveStatus("error");
          toast.error("Failed to save your canvas");
        }
      }
    },
    []
  );

  const handleRename = useCallback(async () => {
    const title = renameValue.trim();
    if (!activeId || !title || title === activeTitleRef.current) {
      setRenameValue(activeTitleRef.current);
      return;
    }
    activeTitleRef.current = title;
    setCanvases((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, title } : c))
    );
    try {
      const res = await fetch("/api/canvas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeId, title }),
      });
      if (!res.ok) throw new Error("Rename failed");
    } catch {
      toast.error("Failed to rename board");
    }
  }, [activeId, renameValue]);

  const handleDelete = useCallback(async () => {
    if (!activeId) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/canvas?id=${activeId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to delete board");
      }
      const remaining = canvases.filter((c) => c.id !== activeId);
      setCanvases(remaining);
      setDeleteOpen(false);
      toast.success("Board deleted");
      if (remaining.length > 0) {
        await selectBoard(remaining[0].id);
      } else {
        await createBoard(true);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete board"
      );
    } finally {
      setDeleteLoading(false);
    }
  }, [activeId, canvases, selectBoard, createBoard]);

  const statusPill =
    saveStatus === "saving" ? (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> Saving…
      </span>
    ) : saveStatus === "error" ? (
      <span className="flex items-center gap-1.5 text-xs text-destructive">
        <AlertCircle className="size-3.5" /> Save failed
      </span>
    ) : (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Check className="size-3.5" /> Saved
      </span>
    );

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] w-full flex-col gap-3 py-4">
      {/* ── Header (same style as the other pages, above the canvas) ───── */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight">Canvas</h1>
          <Badge
            variant="secondary"
            className="rounded-full px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
          >
            {canvases.length} board{canvases.length !== 1 ? "s" : ""}
          </Badge>
          {activeId && !docLoading && statusPill}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={toggleFullscreen}
            aria-label={
              isFullscreen ? "Exit full mode" : "Enter full mode"
            }
          >
            {isFullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
            {isFullscreen ? "Exit full mode" : "Full mode"}
          </Button>

          <Button
            variant="outline"
            disabled={creating}
            onClick={() => createBoard(true)}
          >
            {creating ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            New board
          </Button>
        </div>
      </div>

      {/* ── Board switcher + rename + delete (stacked above the canvas) ─ */}
      <div className="relative z-20 flex items-center gap-2">
        <Select
          value={activeId ?? ""}
          onValueChange={(value) => {
            if (value && value !== activeId) selectBoard(value);
          }}
        >
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Select a board" />
          </SelectTrigger>
          <SelectContent className="z-[99999]">
            {canvases.map((canvas) => (
              <SelectItem key={canvas.id} value={canvas.id}>
                {canvas.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          placeholder="Board name"
          disabled={!activeId || docLoading}
          className="max-w-xs"
        />

        <Button
          variant="outline"
          size="icon"
          disabled={!activeId || docLoading}
          onClick={() => setDeleteOpen(true)}
          aria-label="Delete board"
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>

      {/* ── Editor (fills the rest of the page, below the controls) ───── */}
      <div
        ref={canvasContainerRef}
        className={cn(
          "relative z-0 min-h-0 w-full flex-1 overflow-hidden rounded-lg border bg-card",
          isFullscreen &&
            "flex-none h-screen w-screen rounded-none border-0"
        )}
      >
        {listLoading || docLoading ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-28" />
          </div>
        ) : activeId ? (
          <TldrawEditor
            key={activeId}
            boardId={activeId}
            initialDocument={activeDoc}
            onDocumentChange={handleDocumentChange}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <p className="text-sm text-muted-foreground">No board selected</p>
            <Button
              variant="outline"
              disabled={creating}
              onClick={() => createBoard(true)}
            >
              <Plus className="size-4" /> Create a board
            </Button>
          </div>
        )}
      </div>

      {/* ── Confirm Delete Dialog (same as the other pages) ────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          className="max-w-sm"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Delete this board?
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              This action cannot be undone. The board and everything drawn on
              it will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={deleteLoading}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteLoading}
              onClick={handleDelete}
            >
              {deleteLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Deleting…
                </span>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
