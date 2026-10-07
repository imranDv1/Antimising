"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import CreateNotes from "./createNotes";
import { authClient } from "@/lib/auth-client";
import { useNoteNotificationStore } from "@/context/notesUpateStore";
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

  const [notes, setNotes] = useState<Note[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);

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
        setNotes((prev) => {
          if (!append) return data.mine;
          // Offset pagination can drift when ordering changes between fetches
          // (favorite toggle / edit), returning notes already on the previous
          // page. Dedupe by id so React keys stay unique.
          const merged = new Map<string, Note>();
          for (const n of prev.concat(data.mine)) merged.set(n.id, n);
          return Array.from(merged.values());
        });
        setTotalCount(data.totalCount ?? 0);
        setHasMore(data.hasMore ?? false);
        pageRef.current = page;
      } catch (err) {
        console.error(err);
      } finally {
        setInitialLoading(false);
        setLoadingMore(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!userId) return;
    setInitialLoading(true);
    setHasMore(false);
    fetchPage(1, false);
  }, [userId, refreshSignal, fetchPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore || initialLoading) return;
    fetchPage(pageRef.current + 1, true);
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