"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  Ban,
  Check,
  Loader2,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  Share2,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { useIsMobile } from "@/hooks/use-mobile";
import { useFavNotificationStore } from "@/context/updateFavorite";
import {
  useCanvasCacheStore,
  type BoardMeta,
} from "@/context/canvasCacheStore";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareCanvasDialog } from "@/components/share-dialog";
import type { CanvasDocument } from "@/components/canvas/excalidraw-editor";

const ExcalidrawEditor = dynamic(
  () => import("@/components/canvas/excalidraw-editor"),
  {
    ssr: false,
    loading: () => (
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-card">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0.07)_1px,transparent_1.5px)] dark:bg-[radial-gradient(circle,rgba(255,255,255,0.09)_1px,transparent_1.5px)]"
          style={{ backgroundSize: "26px 26px" }}
        />
        <Loader2 className="relative size-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

type BoardPermission = "owner" | "read" | "write";

type CanvasMeta = {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  permission: BoardPermission;
  ownerName?: string | null;
  ownerEmail?: string | null;
};

type SaveStatus = "saved" | "saving" | "error";

// 🧠 الكاش يعتبر "طازجًا" خلال 60 ثوانٍ — نعرض السين فورًا دون أي طلب شبكة
const TTL_MS = 60_000;

// Mirrors the Excalidraw UI (floating top toolbar + dot-grid canvas + bottom
// controls) so the loading state doesn't flash a generic layout.
function CanvasBoardSkeleton() {
  return (
    <div className="flex h-full w-full flex-col bg-card">
      {/* Top floating toolbar */}
      <div className="flex justify-center pt-3">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-background p-1.5 shadow-sm">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="size-8 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Canvas area with Excalidraw-style dot grid */}
      <div className="relative mx-4 mb-3 mt-4 min-h-0 flex-1 overflow-hidden rounded-lg border border-border/60">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0.07)_1px,transparent_1.5px)] dark:bg-[radial-gradient(circle,rgba(255,255,255,0.09)_1px,transparent_1.5px)]"
          style={{ backgroundSize: "26px 26px" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex w-80 max-w-[calc(100%-3rem)] flex-col gap-3 rounded-xl border border-border/70 bg-background/70 p-5 shadow-md backdrop-blur-sm">
            <Skeleton className="h-4 w-1/2 rounded" />
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-2/3 rounded" />
          </div>
        </div>
      </div>

      {/* Bottom zoom/controls */}
      <div className="flex justify-center gap-3 pb-4">
        <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1 shadow-sm">
          <Skeleton className="size-6 rounded" />
          <Skeleton className="h-6 w-14 rounded" />
          <Skeleton className="size-6 rounded" />
        </div>
      </div>
    </div>
  );
}

export default function CanvasPage() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const triggerFavRefresh = useFavNotificationStore(
    (state) => state.triggerFavRefresh
  );
  const [canvases, setCanvases] = useState<CanvasMeta[]>([]);
  const [sharedCanvases, setSharedCanvases] = useState<CanvasMeta[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activePermission, setActivePermission] =
    useState<BoardPermission | null>(null);
  const [activeDoc, setActiveDoc] = useState<CanvasDocument | null>(null);
  const [docLoading, setDocLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [renameValue, setRenameValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favLoading, setFavLoading] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const isMobile = useIsMobile();
  const saveSeqRef = useRef(0);
  const activeTitleRef = useRef("");
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const allBoards = useMemo(
    () => [...canvases, ...sharedCanvases],
    [canvases, sharedCanvases]
  );

  // Only the owner can rename/delete/share; a "write" grant may edit the
  // scene; a "read" grant opens the board in view mode.
  const canEdit = activePermission === "owner" || activePermission === "write";
  const canManage = activePermission === "owner";

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

  const selectBoard = useCallback(
    async (id: string) => {
      if (!userId) return;
      const stored = useCanvasCacheStore.getState().cache[id];
      const validForUser = stored && stored.userId === userId;

      const applyBoard = (
        boardId: string,
        title: string,
        permission: BoardPermission | null,
        document: CanvasDocument | null
      ) => {
        setActiveId(boardId);
        setActivePermission(permission ?? "owner");
        setRenameValue(title);
        activeTitleRef.current = title;
        setActiveDoc(document ?? null);
        setSaveStatus("saved");
        setDocLoading(false);
      };

      // اجلب اللوحة كاملًا (فك تشفير) وخزّنها في الكاش
      const fetchFull = async () => {
        try {
          const res = await fetch(`/api/canvas?id=${id}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data?.message || "Failed to load board");
          const canvas = data.canvas;
          useCanvasCacheStore.getState().set({
            boardId: canvas.id,
            userId,
            title: canvas.title,
            document: canvas.document ?? null,
            permission: canvas.permission ?? "owner",
            updatedAt: canvas.updatedAt,
            fetchedAt: Date.now(),
          });
          applyBoard(canvas.id, canvas.title, canvas.permission, canvas.document);
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Failed to load board"
          );
          setDocLoading(false);
        }
      };

      // تحقق خفيف بدون فك تشفير: إذا لم يتغير updatedAt/permission نكتفي بالكاش
      const revalidate = async () => {
        try {
          const res = await fetch(`/api/canvas?id=${id}&metaOnly=1`);
          const data = await res.json();
          if (!res.ok) throw new Error(data?.message || "Failed to load board");
          const canvas = data.canvas;
          const current = useCanvasCacheStore.getState().cache[id];
          if (
            !current ||
            canvas.updatedAt !== current.updatedAt ||
            canvas.permission !== current.permission
          ) {
            setDocLoading(true);
            await fetchFull();
          }
        } catch (err) {
          console.error(err);
          setDocLoading(true);
          await fetchFull();
        }
      };

      if (validForUser) {
        // عرض فوري من الكاش دون أي انتظار
        applyBoard(id, stored.title, stored.permission, stored.document);
        // إذا كان الكاش طازجًا نتجاوز التحقق تمامًا
        if (Date.now() - stored.fetchedAt < TTL_MS) return;
        revalidate();
      } else {
        setDocLoading(true);
        setActiveId(null);
        setActiveDoc(null);
        setActivePermission(null);
        fetchFull();
      }
    },
    [userId]
  );

  // Load which of the caller's boards are favorited (for the star button).
  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/favorite-canvas?userId=${userId}`, {
          cache: "no-cache",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setFavoriteIds(
            (data ?? []).map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (f: any) => f.canvasId
            )
          );
        }
      } catch {
        // Favorites are non-critical; ignore failures here.
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const isFavorite = activeId ? favoriteIds.includes(activeId) : false;

  const toggleFavorite = useCallback(async () => {
    if (!userId || !activeId) return;
    setFavLoading(true);
    const wasFav = favoriteIds.includes(activeId);
    try {
      const res = await fetch("/api/favorite-canvas", {
        method: wasFav ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, canvasId: activeId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || data?.message || "Request failed");
      }
      setFavoriteIds((prev) =>
        wasFav
          ? prev.filter((id) => id !== activeId)
          : [...prev, activeId]
      );
      triggerFavRefresh();
      toast.success(wasFav ? "Removed from favorites" : "Added to favorites");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update favorite"
      );
    } finally {
      setFavLoading(false);
    }
  }, [userId, activeId, favoriteIds, triggerFavRefresh]);

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
        useCanvasCacheStore.getState().patchList((l) => ({
          ...l,
          canvases: [data.canvas as BoardMeta, ...l.canvases],
        }));
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

  // Initial load: serve the boards list from cache when it exists, otherwise
// fetch owned + shared boards and auto-create the first one only when there
// is nothing at all to open.
useEffect(() => {
  if (!userId) return;
  (async () => {
    const store = useCanvasCacheStore.getState();
    const list = store.list;
    const hasValidCache = list && list.userId === userId;

    const selectInitialBoard = (
      owned: BoardMeta[],
      shared: BoardMeta[]
    ) => {
      // Deep link support: /dashboard/canvas?board=<id> opens that board.
      const boardParam = new URLSearchParams(window.location.search).get(
        "board"
      );
      const requested =
        boardParam &&
        [...owned, ...shared].some((c) => c.id === boardParam)
          ? boardParam
          : null;

      if (requested) {
        selectBoard(requested);
      } else if (owned.length > 0) {
        selectBoard(owned[0].id);
      } else if (shared.length > 0) {
        selectBoard(shared[0].id);
      } else {
        createBoard(true);
      }
    };

    // جلب القائمة وخزنها في الكاش (بدون تغيير اللوحة المفتوحة حاليًا)
    const loadList = async (selectFirst: boolean) => {
      try {
        const res = await fetch("/api/canvas");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Failed to load boards");
        const owned: BoardMeta[] = data.canvases ?? [];
        const shared: BoardMeta[] = data.sharedCanvases ?? [];
        useCanvasCacheStore.getState().setList(userId, owned, shared);
        setCanvases(owned);
        setSharedCanvases(shared);
        if (selectFirst) selectInitialBoard(owned, shared);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load boards"
        );
      } finally {
        setListLoading(false);
        setDocLoading(false);
      }
    };

    if (hasValidCache) {
      // عرض فوري من الكاش دون أي انتظار
      setListLoading(false);
      setCanvases(list.canvases);
      setSharedCanvases(list.sharedCanvases);
      selectInitialBoard(list.canvases, list.sharedCanvases);
      // إعادة تحقق خلفية فقط إذا انتهت صلاحية الكاش
      if (Date.now() - list.fetchedAt >= TTL_MS) {
        loadList(false);
      } else {
        setDocLoading(false);
      }
    } else {
      await loadList(true);
    }
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [userId]);

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
        // خزّن آخر نسخة محفوظة في الكاش حتى لا نعتمد لاحقًا على نسخة قديمة
        const data = await res.json().catch(() => null);
        useCanvasCacheStore.getState().patch(boardId, {
          document,
          updatedAt: data?.canvas?.updatedAt ?? undefined,
          fetchedAt: Date.now(),
        });
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
    if (!activeId || !canManage || !title || title === activeTitleRef.current) {
      setRenameValue(activeTitleRef.current);
      return;
    }
    activeTitleRef.current = title;
    setCanvases((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, title } : c))
    );
    useCanvasCacheStore.getState().patchList((l) => ({
      ...l,
      canvases: l.canvases.map((c) => (c.id === activeId ? { ...c, title } : c)),
    }));
    try {
      const res = await fetch("/api/canvas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeId, title }),
      });
      if (!res.ok) throw new Error("Rename failed");
      const data = await res.json().catch(() => null);
      useCanvasCacheStore.getState().patch(activeId, {
        title,
        updatedAt: data?.canvas?.updatedAt ?? undefined,
        fetchedAt: Date.now(),
      });
    } catch {
      toast.error("Failed to rename board");
    }
  }, [activeId, renameValue, canManage]);

  // Mobile rename: a floating input instead of an inline field that would eat
  // the little horizontal space available.
  const openRename = () => {
    setRenameValue(activeTitleRef.current);
    setRenameOpen(true);
  };

  const cancelRename = () => {
    setRenameValue(activeTitleRef.current);
    setRenameOpen(false);
  };

  const commitRename = () => {
    setRenameOpen(false);
    void handleRename();
  };

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
      setCanvases((prev) => prev.filter((c) => c.id !== activeId));
      setSharedCanvases((prev) => prev.filter((c) => c.id !== activeId));
      useCanvasCacheStore.getState().remove(activeId);
      useCanvasCacheStore.getState().patchList((l) => ({
        ...l,
        canvases: l.canvases.filter((c) => c.id !== activeId),
        sharedCanvases: l.sharedCanvases.filter((c) => c.id !== activeId),
      }));
      setDeleteOpen(false);
      toast.success("Board deleted");

      const remaining = allBoards.filter((c) => c.id !== activeId);
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
  }, [activeId, allBoards, selectBoard, createBoard]);

  // Reject (decline) a board someone shared with me — removes only my access.
  const handleLeaveShared = useCallback(async () => {
    if (!activeId || !userId) return;
    setLeaveLoading(true);
    const leavingId = activeId;
    try {
      const res = await fetch(
        `/api/canvas/share/leave?canvasId=${encodeURIComponent(leavingId)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Failed to reject board");

      setSharedCanvases((prev) => prev.filter((c) => c.id !== leavingId));
      setFavoriteIds((prev) => prev.filter((id) => id !== leavingId));
      triggerFavRefresh();
      useCanvasCacheStore.getState().remove(leavingId);
      useCanvasCacheStore.getState().patchList((l) => ({
        ...l,
        sharedCanvases: l.sharedCanvases.filter((c) => c.id !== leavingId),
      }));
      setLeaveOpen(false);
      toast.success("Share rejected");

      const remaining = allBoards.filter((c) => c.id !== leavingId);
      if (remaining.length > 0) {
        await selectBoard(remaining[0].id);
      } else {
        await createBoard(true);
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reject board"
      );
    } finally {
      setLeaveLoading(false);
    }
  }, [activeId, userId, allBoards, selectBoard, createBoard, triggerFavRefresh]);

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

  const boardLabel = (canvas: CanvasMeta) =>
    canvas.ownerName
      ? `${canvas.title} — ${canvas.ownerName}`
      : canvas.title;

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
            {allBoards.length} board{allBoards.length !== 1 ? "s" : ""}
          </Badge>
          {activeId && !docLoading && canEdit && statusPill}
          {activePermission === "read" && activeId && !docLoading && (
            <Badge
              variant="outline"
              className="rounded-full px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            >
              View only
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeId && !docLoading && (
            <Button
              variant="outline"
              size="icon"
              disabled={favLoading}
              onClick={toggleFavorite}
              aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            >
              {favLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Star
                  className="size-4"
                  fill={isFavorite ? "#FBBF24" : "none"}
                  color="#F59E0B"
                />
              )}
            </Button>
          )}

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
          <SelectTrigger className="w-full min-w-0 sm:w-[260px] sm:flex-none">
            <SelectValue placeholder="Select a board" />
          </SelectTrigger>
          <SelectContent className="z-[99999]">
            {canvases.length > 0 && (
              <SelectGroup>
                <SelectLabel>My boards</SelectLabel>
                {canvases.map((canvas) => (
                  <SelectItem key={canvas.id} value={canvas.id}>
                    {canvas.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {sharedCanvases.length > 0 && (
              <SelectGroup>
                <SelectLabel>Shared with me</SelectLabel>
                {sharedCanvases.map((canvas) => (
                  <SelectItem key={canvas.id} value={canvas.id}>
                    {boardLabel(canvas)}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>

        {isMobile ? (
          canManage && (
            <div className="relative shrink-0">
              <Button
                variant="outline"
                size="icon"
                disabled={!activeId || docLoading}
                onClick={openRename}
                aria-label="Rename board"
              >
                <Pencil className="size-4" />
              </Button>

              {renameOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={cancelRename}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 top-full z-50 mt-2 w-[min(calc(100vw-2rem),20rem)] rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-lg">
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          commitRename();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          e.stopPropagation();
                          cancelRename();
                        }
                      }}
                      placeholder="Board name"
                      autoFocus
                    />
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelRename}
                      >
                        <X className="size-4" />
                        Cancel
                      </Button>
                      <Button size="sm" onClick={commitRename}>
                        <Check className="size-4" />
                        Save
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        ) : (
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder="Board name"
            disabled={!activeId || docLoading || !canManage}
            className="max-w-xs"
          />
        )}

        {canManage && (
          <Button
            variant="outline"
            size="icon"
            disabled={!activeId || docLoading}
            onClick={() => setDeleteOpen(true)}
            aria-label="Delete board"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        )}

        {canManage && (
          <Button
            variant="outline"
            size={isMobile ? "icon" : "default"}
            disabled={!activeId || docLoading}
            onClick={() => setShareOpen(true)}
            aria-label="Share board"
          >
            <Share2 className="size-4" />
            {!isMobile && "Share"}
          </Button>
        )}

        {!canManage && activeId && !docLoading && (
          <Button
            variant="outline"
            size={isMobile ? "icon" : "default"}
            onClick={() => setLeaveOpen(true)}
            aria-label="Reject shared board"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Ban className="size-4" />
            {!isMobile && "Reject"}
          </Button>
        )}
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
          <CanvasBoardSkeleton />
        ) : activeId ? (
          <ExcalidrawEditor
            key={activeId}
            boardId={activeId}
            initialDocument={activeDoc}
            onDocumentChange={handleDocumentChange}
            readOnly={!canEdit}
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

        {/* Floating exit button so full mode is easy to leave even though the
            page header (with the toggle) is hidden in browser fullscreen */}
        {isFullscreen && (
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label="Hide full mode"
            className="absolute bottom-20 left-20 z-[10000] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-border bg-background/90 px-3.5 py-2 text-xs font-medium text-foreground shadow-md backdrop-blur transition-colors hover:bg-muted sm:left-auto sm:right-26 sm:top-4 sm:bottom-auto sm:translate-x-0"
          >
            <Minimize2 className="size-4" />
            Hide full mode
          </button>
        )}
      </div>

      {/* ── Share Dialog (owner only) ─────────────────────────────────── */}
      {activeId && canManage && (
        <ShareCanvasDialog
          canvasId={activeId}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      )}

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

      {/* ── Reject-share confirmation (boards shared with me) ─────────── */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent
          className="max-w-sm"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Ban className="size-4 text-destructive" />
              Reject this shared board?
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              {activeId && sharedCanvases.some((c) => c.id === activeId)
                ? `“${boardLabel(sharedCanvases.find((c) => c.id === activeId)!)}” will be removed from your account and you will lose access to it. The owner keeps their own copy.`
                : "This board will be removed from your account."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={leaveLoading}
              onClick={() => setLeaveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={leaveLoading}
              onClick={handleLeaveShared}
            >
              {leaveLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Rejecting…
                </span>
              ) : (
                "Reject"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
