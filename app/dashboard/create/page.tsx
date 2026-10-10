"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import CreateNotes from "./createNotes";
import { authClient } from "@/lib/auth-client";
import { useNoteNotificationStore } from "@/context/notesUpateStore";
import { useNotesCacheStore } from "@/context/notesCacheStore";
import NotesLoadingSkeleton from "./_components/NotesLoadingSkeleton ";

const PAGE_SIZE = 10;

type Note = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  title: string;
  description: string;
  category: string[];
  permission?: "owner" | "read" | "write";
  shareCount?: number;
  ownerName?: string;
  ownerEmail?: string;
};

type NotesPayload = {
  mine: Note[];
  totalCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
};

const Page = () => {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  // Read the list from the module-level cache so returning from a note page
  // (or any client navigation) does not trigger a refetch.
  const notes = useNotesCacheStore((s) => s.notes);
  const totalCount = useNotesCacheStore((s) => s.totalCount);
  const hasMore = useNotesCacheStore((s) => s.hasMore);

  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const hydratedRef = useRef(false);

  const refreshSignal = useNoteNotificationStore(
    (state) => state.refreshNoteSignal
  );

  const fetchPage = useCallback(
    async (page: number, append: boolean) => {
      if (!userId) return;
      if (append) setLoadingMore(true);

      try {
        const res = await fetch(
          `/api/notes?userId=${userId}&page=${page}&limit=${PAGE_SIZE}`,
          {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            cache: "no-cache",
          }
        );

        if (!res.ok) throw new Error("Failed to fetch notes");

        const data: NotesPayload = await res.json();

        const store = useNotesCacheStore.getState();
        let merged: Note[] = data.mine;
        if (append) {
          // Offset pagination can drift when ordering changes between fetches
          // (favorite toggle / edit), returning notes already on the previous
          // page. Dedupe by id so React keys stay unique.
          const map = new Map<string, Note>();
          for (const n of store.notes.concat(data.mine)) map.set(n.id, n);
          merged = Array.from(map.values());
        }

        useNotesCacheStore.getState().setSnapshot(userId, {
          notes: merged,
          totalCount: data.totalCount ?? 0,
          hasMore: data.hasMore ?? false,
          page,
        });
      } catch (err) {
        console.error(err);
      } finally {
        setInitialLoading(false);
        setLoadingMore(false);
      }
    },
    [userId]
  );

  // On mount: reuse the cached list when this user already has one loaded,
  // otherwise fetch the first page. No refetch when returning from a note.
  useEffect(() => {
    if (!userId) return;
    const store = useNotesCacheStore.getState();
    if (store.userId === userId && store.notes.length > 0) {
      setInitialLoading(false);
    } else {
      fetchPage(1, false);
    }
    hydratedRef.current = true;
  }, [userId, fetchPage]);

  // Refetch only when the refresh signal actually changes after this page
  // mounted (new/edited/deleted part of a fresh list on the same visit).
  const prevSignalRef = useRef(refreshSignal);
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (prevSignalRef.current !== refreshSignal) {
      prevSignalRef.current = refreshSignal;
      fetchPage(1, false);
    }
  }, [refreshSignal, fetchPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || initialLoading) return;
    const page = useNotesCacheStore.getState().page + 1;
    fetchPage(page, true);
  }, [hasMore, loadingMore, initialLoading, fetchPage]);

  if (initialLoading && notes.length === 0) return <NotesLoadingSkeleton />;

  return (
    <CreateNotes
      notes={notes}
      totalCount={totalCount}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={loadMore}
    />
  );
};

export default Page;