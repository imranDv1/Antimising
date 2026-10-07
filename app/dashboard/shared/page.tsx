/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Note, NoteCard, sortFavoritesFirst } from "@/components/note-card";
import { authClient } from "@/lib/auth-client";
import { useSharedStore } from "@/context/sharedStore";
import { useRouter } from "next/navigation";
import NotesLoadingSkeleton from "../create/_components/NotesLoadingSkeleton ";
import { Users } from "lucide-react";
import { toast } from "sonner";

const Page = () => {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const [notes, setNotes] = useState<Note[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openingNoteId, setOpeningNoteId] = useState<string | null>(null);
  const [favoriteStatus, setFavoriteStatus] = useState<Record<string, boolean>>({});
  const [favoriteLoading, setFavoriteLoading] = useState<Record<string, boolean>>({});

  const refreshSharedSignal = useSharedStore((s) => s.refreshSharedSignal);

  const loadFavorites = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/favorite?userId=${userId}`, { cache: "no-cache" });
      const favs = (await res.json()) as any[];
      const map: Record<string, boolean> = {};
      (favs || []).forEach((f: any) => (map[f.noteId] = true));
      setFavoriteStatus(map);
    } catch (err) {
      console.error(err);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      try {
        const res = await fetch(`/api/shared-notes?userId=${userId}`, {
          cache: "no-cache",
        });
        if (!res.ok) throw new Error("Failed to fetch shared notes");
        const data = await res.json();
        setNotes(data.notes ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
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
      setFavoriteStatus((p) => ({ ...p, [noteId]: !isFav }));
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
          {sortFavoritesFirst(notes, favoriteStatus).map((note) => (
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