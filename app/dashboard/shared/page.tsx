/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Note, NoteCard, sortFavoritesFirst } from "@/components/note-card";
import { authClient } from "@/lib/auth-client";
import { useSharedStore } from "@/context/sharedStore";
import { useSharedCacheStore } from "@/context/sharedCacheStore";
import { useNotesCacheStore } from "@/context/notesCacheStore";
import { useFavoritesOnTop } from "@/context/notesPrefsStore";
import { useFavoritesCacheStore } from "@/context/favoritesCacheStore";
import { useFavNotificationStore } from "@/context/updateFavorite";
import { useRouter } from "next/navigation";
import NotesLoadingSkeleton from "../create/_components/NotesLoadingSkeleton ";
import { Ban, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// 🧠 الكاش يعتبر "طازجًا" خلال 60 ثوانٍ — لا جلب عند الرجوع لهذه الصفحة
const TTL_MS = 60_000;

const Page = () => {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const [notes, setNotes] = useState<Note[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openingNoteId, setOpeningNoteId] = useState<string | null>(null);
  const favoriteStatus = useFavoritesCacheStore((s) => s.status);
  const [favoriteLoading, setFavoriteLoading] = useState<Record<string, boolean>>({});
  const [favoritesOnTop] = useFavoritesOnTop();

  const refreshSharedSignal = useSharedStore((s) => s.refreshSharedSignal);
  const triggerSharedRefresh = useSharedStore((s) => s.triggerSharedRefresh);
  const prevSignalRef = useRef(refreshSharedSignal);

  // Rejecting a share: the recipient removes their own access.
  const [declineTarget, setDeclineTarget] = useState<Note | null>(null);
  const [declining, setDeclining] = useState(false);

  const triggerFavRefresh = useFavNotificationStore(
    (s) => s.triggerFavRefresh
  );

  const loadFavorites = useCallback(async () => {
    if (!userId) return;
    // Use the cached flags when available so favorites stay pinned to the top
    // instantly; only fetch when the flags have not been hydrated for this
    // user yet. `userId` alone is not enough because it is also set when the
    // favorites lists are cached without the per-note star flags.
    const cached = useFavoritesCacheStore.getState();
    if (cached.statusUserId === userId) return;
    try {
      const res = await fetch(`/api/favorite?userId=${userId}`, { cache: "no-cache" });
      const favs = (await res.json()) as any[];
      const map: Record<string, boolean> = {};
      (favs || []).forEach((f: any) => (map[f.noteId] = true));
      useFavoritesCacheStore.getState().setStatus(userId, map);
    } catch (err) {
      console.error(err);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const load = async (showSkeleton = true) => {
      try {
        if (showSkeleton) setLoading(true);
        const res = await fetch(`/api/shared-notes?userId=${userId}`, {
          cache: "no-cache",
        });
        if (!res.ok) throw new Error("Failed to fetch shared notes");
        const data = await res.json();
        const loadedNotes = (data.notes ?? []) as Note[];
        const loadedUnread = data.unreadCount ?? 0;
        useSharedCacheStore.getState().set(userId, loadedNotes, loadedUnread);
        setNotes(loadedNotes);
        setUnreadCount(loadedUnread);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const store = useSharedCacheStore.getState();
    const signalChanged = prevSignalRef.current !== refreshSharedSignal;
    prevSignalRef.current = refreshSharedSignal;

    if (store.userId === userId) {
      // 🧠 عرض فوري من الكاش، مع إعادة تحقق خلفية فقط عند انتهاء الصلاحية
      setNotes(store.notes);
      setUnreadCount(store.unreadCount);
      setLoading(false);
      const fresh = Date.now() - store.fetchedAt < TTL_MS;
      if (fresh && !signalChanged) return;
      load(false);
    } else {
      load();
    }

    loadFavorites();
  }, [userId, refreshSharedSignal, loadFavorites]);

  const handleToggleFavorite = async (noteId: string) => {
    if (!userId) return;
    setFavoriteLoading((p) => ({ ...p, [noteId]: true }));
    try {
      const isFav = favoriteStatus[noteId] ?? false;
      const res = await fetch("/api/favorite", {
        method: isFav ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, noteId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Request failed");
      useFavoritesCacheStore.getState().toggle(noteId, !isFav);
      triggerFavRefresh();
      const favStore = useFavoritesCacheStore.getState();
      if (isFav) {
        favStore.removeNote(userId, noteId);
      } else if (data?.favorite?.id) {
        const note = notes.find((n) => n.id === noteId);
        if (note) {
          favStore.addNote(userId, {
            id: data.favorite.id,
            userId,
            noteId,
            createdAt: new Date(data.favorite.createdAt),
            note: {
              id: note.id,
              title: note.title,
              description: note.description,
              category: note.category,
              createdAt: new Date(note.createdAt),
              updatedAt: new Date(note.updatedAt),
              userId: note.userId,
            },
          });
        }
      }
      toast.success(isFav ? "Removed from favorites" : "Added to favorites");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setFavoriteLoading((p) => ({ ...p, [noteId]: false }));
    }
  };

  const handleOpenNote = (noteId: string) => {
    if (openingNoteId) return;
    setOpeningNoteId(noteId);
    router.push(`/dashboard/notes/${noteId}`);
  };

  // Reject (decline) a note someone shared with me — removes only my access.
  const handleDecline = async () => {
    if (!declineTarget || !userId) return;
    setDeclining(true);
    const noteId = declineTarget.id;
    try {
      const res = await fetch(
        `/api/shared-notes?noteId=${encodeURIComponent(noteId)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || "Failed to reject share");

      const nextNotes = notes.filter((n) => n.id !== noteId);
      const nextUnread = Math.max(
        0,
        unreadCount - (declineTarget.isRead ? 0 : 1)
      );
      setNotes(nextNotes);
      setUnreadCount(nextUnread);
      useSharedCacheStore.getState().set(userId, nextNotes, nextUnread);
      // Keep the All Notes list in sync as well.
      useNotesCacheStore.getState().removeNote(noteId);

      // A rejected note must not linger in favorites.
      if (useFavoritesCacheStore.getState().status[noteId]) {
        useFavoritesCacheStore.getState().removeNote(userId, noteId);
        triggerFavRefresh();
      }

      // Refresh the sidebar "Shared with me" badge count.
      triggerSharedRefresh();
      toast.success("Share rejected");
      setDeclineTarget(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reject share"
      );
    } finally {
      setDeclining(false);
    }
  };

  if (loading) return <NotesLoadingSkeleton />;

  return (
    <div className="mt-4 flex w-full flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Users className="size-6 text-primary" />
          Shared with me
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {notes.length} note{notes.length !== 1 ? "s" : ""} shared with you
          {unreadCount > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
              {unreadCount} new
            </span>
          )}
        </p>
      </div>

      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <Users className="size-10 text-primary" />
          <p className="text-lg font-semibold text-foreground">No shared notes yet</p>
          <p className="text-sm text-muted-foreground">
            Notes shared with you will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 pb-10 sm:grid-cols-2 lg:grid-cols-3">
          {(favoritesOnTop
                  ? sortFavoritesFirst(notes, favoriteStatus)
                  : [...notes].sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime()
                    )
                ).map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              favoriteStatus={favoriteStatus}
              favoriteLoading={favoriteLoading}
              deleteLoading={null}
              openingNoteId={openingNoteId}
              onFavorite={handleToggleFavorite}
              onDelete={() => {}}
              onEdit={() => handleOpenNote(note.id)}
              onOpen={() => handleOpenNote(note.id)}
              onDecline={(id) =>
                setDeclineTarget(notes.find((n) => n.id === id) ?? null)
              }
              declining={declining && declineTarget?.id === note.id}
              clickableTags={false}
              isNew={!note.isRead}
            />
          ))}
        </div>
      )}

      {/* ── Reject-share confirmation ─────────────────────────────────── */}
      <Dialog
        open={!!declineTarget}
        onOpenChange={(open) => {
          if (!open && !declining) setDeclineTarget(null);
        }}
      >
        <DialogContent
          className="max-w-sm"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <Ban className="size-4 text-destructive" />
              Reject this shared note?
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              {declineTarget
                ? `“${declineTarget.title}” will be removed from your account and you will lose access to it. The owner keeps their own copy.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={declining}
              onClick={() => setDeclineTarget(null)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={declining}
              onClick={handleDecline}
            >
              {declining ? (
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
};

export default Page;