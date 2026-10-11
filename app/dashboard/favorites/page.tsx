"use client";

import React, { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useFavNotificationStore } from "@/context/updateFavorite";
import { useFavoritesCacheStore } from "@/context/favoritesCacheStore";
import type {
  FavoriteNote,
  FavoriteCanvas,
} from "@/context/favoritesCacheStore";
import NotesLoadingSkeleton from "../create/_components/NotesLoadingSkeleton ";
import { NoteCard, Note } from "@/components/note-card";
import { CanvasCard, CanvasMeta } from "@/components/canvas-card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Star } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

// 🧠 الكاش يعتبر "طازجًا" خلال 60 ثوانٍ — لا جلب عند الرجوع لهذه الصفحة
const TTL_MS = 60_000;

type DeleteTarget = { type: "note" | "canvas"; id: string } | null;

const toNote = (favorite: FavoriteNote): Note => ({
  id: favorite.noteId,
  createdAt: new Date(favorite.note.createdAt),
  updatedAt: new Date(favorite.note.updatedAt),
  userId: favorite.note.userId,
  title: favorite.note.title,
  description: favorite.note.description,
  category: favorite.note.category,
});

const toCanvas = (favorite: FavoriteCanvas): CanvasMeta => ({
  id: favorite.canvasId,
  title: favorite.canvas.title,
  userId: favorite.canvas.userId,
  createdAt: favorite.canvas.createdAt,
  updatedAt: favorite.canvas.updatedAt,
  permission: favorite.permission ?? "owner",
});

const FavoritesPage = () => {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const router = useRouter();
  const [notes, setNotes] = useState<FavoriteNote[]>([]);
  const [canvases, setCanvases] = useState<FavoriteCanvas[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteLoading, setFavoriteLoading] = useState<
    Record<string, boolean>
  >({});
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [filter, setFilter] = useState<"all" | "note" | "canvas">("all");

  const refreshSignal = useFavNotificationStore(
    (state) => state.refreshFavSignal
  );

  const triggerFavRefresh = useFavNotificationStore(
    (state) => state.triggerFavRefresh
  );

  const prevSignalRef = useRef(refreshSignal);

  useEffect(() => {
    if (!userId) return;

    const fetchFavorites = async (showSkeleton = true) => {
      try {
        if (showSkeleton) setLoading(true);
        const [notesRes, canvasesRes] = await Promise.all([
          fetch(`/api/favorite?userId=${userId}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-cache",
          }),
          fetch(`/api/favorite-canvas?userId=${userId}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-cache",
          }),
        ]);

        if (!notesRes.ok) throw new Error("Failed to fetch favorite notes");
        if (!canvasesRes.ok) throw new Error("Failed to fetch favorite boards");

        const notesData: FavoriteNote[] = await notesRes.json();
        const canvasesData: FavoriteCanvas[] = await canvasesRes.json();
        useFavoritesCacheStore.getState().setFavorites(
          userId,
          notesData,
          canvasesData
        );
        setNotes(notesData);
        setCanvases(canvasesData);
      } catch (err) {
        console.error("Error fetching favorites:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load favorites";
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    // 🧠 عرض فوري من الكاش إذا كان موجودًا، مع إعادة تحقق خلفية فقط عند انتهائه
    const store = useFavoritesCacheStore.getState();
    const signalChanged = prevSignalRef.current !== refreshSignal;
    prevSignalRef.current = refreshSignal;

    if (store.userId === userId) {
      setNotes(store.notes);
      setCanvases(store.canvases);
      setLoading(false);
      const fresh = Date.now() - store.fetchedAt < TTL_MS;
      if (fresh && !signalChanged) return;
      fetchFavorites(false);
    } else {
      fetchFavorites();
    }
  }, [userId, refreshSignal]);

  const handleRemoveNoteFavorite = async (noteId: string) => {
    if (!userId) return;

    setFavoriteLoading((prev) => ({ ...prev, [noteId]: true }));

    try {
      const res = await fetch("/api/favorite", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, noteId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Request failed");

      const next = (prev: FavoriteNote[]) =>
        prev.filter((fav) => fav.noteId !== noteId);
      setNotes(next);
      useFavoritesCacheStore.getState().setNotes(
        userId,
        next(useFavoritesCacheStore.getState().notes)
      );
      toast.success("Removed from favorites!");
      triggerFavRefresh();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to remove favorite";
      toast.error(errorMessage);
    } finally {
      setFavoriteLoading((prev) => ({ ...prev, [noteId]: false }));
    }
  };

  const handleRemoveCanvasFavorite = async (canvasId: string) => {
    if (!userId) return;

    setFavoriteLoading((prev) => ({ ...prev, [canvasId]: true }));

    try {
      const res = await fetch("/api/favorite-canvas", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, canvasId }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Request failed");

      const next = (prev: FavoriteCanvas[]) =>
        prev.filter((fav) => fav.canvasId !== canvasId);
      setCanvases(next);
      useFavoritesCacheStore.getState().setCanvases(
        userId,
        next(useFavoritesCacheStore.getState().canvases)
      );
      toast.success("Removed from favorites!");
      triggerFavRefresh();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to remove favorite";
      toast.error(errorMessage);
    } finally {
      setFavoriteLoading((prev) => ({ ...prev, [canvasId]: false }));
    }
  };

  const handleDeleteClick = (type: "note" | "canvas", id: string) => {
    setDeleteTarget({ type, id });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (!userId) return;
    const { type, id } = deleteTarget;
    setDeleteLoading(id);
    try {
      const res =
        type === "note"
          ? await fetch(`/api/create/${id}`, { method: "DELETE" })
          : await fetch(`/api/canvas?id=${id}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(
          data?.message || data?.error || `Failed to delete ${type}`
        );
      }

      if (type === "note") {
        const next = (prev: FavoriteNote[]) =>
          prev.filter((fav) => fav.noteId !== id);
        setNotes(next);
        useFavoritesCacheStore.getState().setNotes(
          userId,
          next(useFavoritesCacheStore.getState().notes)
        );
        toast.success("Note deleted");
      } else {
        const next = (prev: FavoriteCanvas[]) =>
          prev.filter((fav) => fav.canvasId !== id);
        setCanvases(next);
        useFavoritesCacheStore.getState().setCanvases(
          userId,
          next(useFavoritesCacheStore.getState().canvases)
        );
        toast.success("Board deleted");
      }

      triggerFavRefresh();
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : `Failed to delete ${type}`
      );
    } finally {
      setDeleteLoading(null);
    }
  };

  const openNote = (noteId: string) => {
    setOpeningId(noteId);
    router.push(`/dashboard/notes/${noteId}`);
  };

  const openCanvas = (canvasId: string) => {
    setOpeningId(canvasId);
    router.push(`/dashboard/canvas?board=${canvasId}`);
  };

  const noteFavoriteStatus = Object.fromEntries(
    notes.map((favorite) => [favorite.noteId, true])
  );

  const canvasFavoriteStatus = Object.fromEntries(
    canvases.map((favorite) => [favorite.canvasId, true])
  );

  const totalCount = notes.length + canvases.length;

  const visibleNotes = filter === "canvas" ? [] : notes;
  const visibleCanvases = filter === "note" ? [] : canvases;
  const visibleCount = visibleNotes.length + visibleCanvases.length;

  if (loading) {
    return <NotesLoadingSkeleton count={6} />;
  }

  return (
    <div className="w-full flex flex-col gap-6 mt-4">
      {/* ── Top bar (same style as My Notebooks) ───────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight">Favorites</h1>
          <Badge
            variant="secondary"
            className="rounded-full px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
          >
            {notes.length} note{notes.length !== 1 ? "s" : ""} · {canvases.length}{" "}
            board{canvases.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/create"
            className={buttonVariants({ variant: "outline" })}
          >
            All notes
          </Link>
          <Link
            href="/dashboard/canvas"
            className={buttonVariants({ variant: "outline" })}
          >
            Canvas
          </Link>
        </div>
      </div>

      {/* ── Filter tabs: All / Notes / Canvas ─────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          All ({totalCount})
        </Button>
        <Button
          size="sm"
          variant={filter === "note" ? "default" : "outline"}
          onClick={() => setFilter("note")}
        >
          Notes ({notes.length})
        </Button>
        <Button
          size="sm"
          variant={filter === "canvas" ? "default" : "outline"}
          onClick={() => setFilter("canvas")}
        >
          Canvas ({canvases.length})
        </Button>
      </div>

      {/* ── Favorites grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 pb-10 gap-4">
        {visibleCount > 0 ? (
          <>
            {visibleNotes.map((favorite) => (
              <NoteCard
                key={favorite.noteId}
                note={toNote(favorite)}
                favoriteStatus={noteFavoriteStatus}
                favoriteLoading={favoriteLoading}
                deleteLoading={deleteLoading}
                openingNoteId={openingId}
                onFavorite={handleRemoveNoteFavorite}
                onDelete={(noteId) => handleDeleteClick("note", noteId)}
                onEdit={(note) => openNote(note.id)}
                onOpen={openNote}
                clickableTags={false}
              />
            ))}

            {visibleCanvases.map((favorite) => (
              <CanvasCard
                key={favorite.canvasId}
                canvas={toCanvas(favorite)}
                favoriteStatus={canvasFavoriteStatus}
                favoriteLoading={favoriteLoading}
                deleteLoading={deleteLoading}
                openingCanvasId={openingId}
                onFavorite={handleRemoveCanvasFavorite}
                onDelete={(canvasId) => handleDeleteClick("canvas", canvasId)}
                onOpen={openCanvas}
              />
            ))}
          </>
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center p-10 min-h-[400px]">
            <Star className="size-16 text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground text-lg mb-2">
              {filter === "note"
                ? "No favorite notes yet"
                : filter === "canvas"
                ? "No favorite boards yet"
                : "No favorites yet"}
            </p>
            <p className="text-muted-foreground/70 text-sm text-center max-w-md">
              {filter === "note"
                ? "Favorite notes by clicking the star icon to find them here quickly."
                : filter === "canvas"
                ? "Favorite canvas boards by clicking the star icon to find them here quickly."
                : "Favorite notes or canvas boards by clicking the star icon to find them here quickly."}
            </p>
            <div className="flex gap-2 mt-4">
              <Link
                href="/dashboard/create"
                className={buttonVariants({ variant: "outline" })}
              >
                Go to Notes
              </Link>
              <Link
                href="/dashboard/canvas"
                className={buttonVariants()}
              >
                Go to Canvas
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* ── Confirm Delete Dialog (same as all notes page) ─────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent
          className="max-w-sm"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Delete this {deleteTarget?.type === "canvas" ? "board" : "note"}?
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              This action cannot be undone. The{" "}
              {deleteTarget?.type === "canvas" ? "board" : "note"} will be
              permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={deleteLoading !== null}
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteLoading !== null}
              onClick={handleConfirmDelete}
            >
              {deleteLoading !== null ? (
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
};

export default FavoritesPage;
