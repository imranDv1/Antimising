/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Note, NoteCard, sortFavoritesFirst } from "@/components/note-card";
import { authClient } from "@/lib/auth-client";
import { useSharedStore } from "@/context/sharedStore";
import { useSharedCacheStore } from "@/context/sharedCacheStore";
import { useFavoritesOnTop } from "@/context/notesPrefsStore";
import { useFavoritesCacheStore } from "@/context/favoritesCacheStore";
import { useFavNotificationStore } from "@/context/updateFavorite";
import { useRouter } from "next/navigation";
import NotesLoadingSkeleton from "../create/_components/NotesLoadingSkeleton ";
import { Users } from "lucide-react";
import { toast } from "sonner";

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
  const prevSignalRef = useRef(refreshSharedSignal);

  const triggerFavRefresh = useFavNotificationStore(
    (s) => s.triggerFavRefresh
  );

  const loadFavorites = useCallback(async () => {
    if (!userId) return;
    // Use the cached flags when available so favorites stay pinned to the top
    // instantly; only fetch when this user has no cache yet.
    const cached = useFavoritesCacheStore.getState();
    if (cached.userId === userId) return;
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
              clickableTags={false}
              isNew={!note.isRead}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Page;