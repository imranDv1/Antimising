"use client";

import React, { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useFavNotificationStore } from "@/context/updateFavorite";
import NotesLoadingSkeleton from "../create/_components/NotesLoadingSkeleton ";
import { NoteCard, Note } from "@/components/note-card";
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

type FavoriteNote = {
  id: string;
  userId: string;
  noteId: string;
  createdAt: Date;
  note: {
    id: string;
    title: string;
    description: string;
    category: string[];
    createdAt: Date;
    updatedAt: Date;
    userId: string;
  };
};

const toNote = (favorite: FavoriteNote): Note => ({
  id: favorite.noteId,
  createdAt: new Date(favorite.note.createdAt),
  updatedAt: new Date(favorite.note.updatedAt),
  userId: favorite.note.userId,
  title: favorite.note.title,
  description: favorite.note.description,
  category: favorite.note.category,
});

const FavoritesPage = () => {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [favoriteLoading, setFavoriteLoading] = useState<
    Record<string, boolean>
  >({});
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [openingNoteId, setOpeningNoteId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);

  const refreshSignal = useFavNotificationStore(
    (state) => state.refreshFavSignal
  );

  const triggerFavRefresh = useFavNotificationStore(
    (state) => state.triggerFavRefresh
  );

  useEffect(() => {
    if (!userId) return;

    const fetchFavorites = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/favorite?userId=${userId}`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-cache",
        });

        if (!res.ok) throw new Error("Failed to fetch favorites");

        const data = await res.json();
        setFavorites(data);
      } catch (err) {
        console.error("Error fetching favorites:", err);
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load favorites";
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [userId, refreshSignal]);

  const handleRemoveFavorite = async (noteId: string) => {
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

      // Remove from local state
      setFavorites((prev) => prev.filter((fav) => fav.noteId !== noteId));
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

  const handleDeleteClick = (noteId: string) => {
    setNoteToDelete(noteId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;
    setDeleteLoading(noteToDelete);
    try {
      const res = await fetch(`/api/create/${noteToDelete}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to delete note");
      }
      setFavorites((prev) => prev.filter((fav) => fav.noteId !== noteToDelete));
      toast.success("Note deleted");
      triggerFavRefresh();
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete note"
      );
    } finally {
      setDeleteLoading(null);
    }
  };

  const openNote = (noteId: string) => {
    setOpeningNoteId(noteId);
    router.push(`/dashboard/notes/${noteId}`);
  };

  const favoriteStatus = Object.fromEntries(
    favorites.map((favorite) => [favorite.noteId, true])
  );

  if (loading) {
    return <NotesLoadingSkeleton count={6} />;
  }

  return (
    <div className="w-full flex flex-col gap-6 mt-4">
      {/* ── Top bar (same style as My Notebooks) ───────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            Favorite Notes
          </h1>
          <Badge
            variant="secondary"
            className="rounded-full px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
          >
            {favorites.length} note{favorites.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        <Link
          href="/dashboard/create"
          className={buttonVariants({ variant: "outline" })}
        >
          All notes
        </Link>
      </div>

      {/* ── Favorites grid ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 pb-10 gap-4">
        {favorites.length > 0 ? (
          favorites.map((favorite) => (
            <NoteCard
              key={favorite.noteId}
              note={toNote(favorite)}
              favoriteStatus={favoriteStatus}
              favoriteLoading={favoriteLoading}
              deleteLoading={deleteLoading}
              openingNoteId={openingNoteId}
              onFavorite={handleRemoveFavorite}
              onDelete={handleDeleteClick}
              onEdit={(note) => openNote(note.id)}
              onOpen={openNote}
              clickableTags={false}
            />
          ))
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center p-10 min-h-[400px]">
            <Star className="size-16 text-muted-foreground mb-4 opacity-50" />
            <p className="text-muted-foreground text-lg mb-2">
              No favorite notes yet
            </p>
            <p className="text-muted-foreground/70 text-sm text-center max-w-md">
              Start adding notes to your favorites by clicking the star icon on
              any note.
            </p>
            <Link
              href="/dashboard/create"
              className={buttonVariants({ className: "mt-4" })}
            >
              Go to Notes
            </Link>
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
              Delete this note?
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              This action cannot be undone. The note will be permanently
              removed.
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
