"use client";

import { IconDots, type Icon } from "@tabler/icons-react";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useEffect, useMemo } from "react";
import { useFavNotificationStore } from "@/context/updateFavorite";
import {
  useFavoritesCacheStore,
  type FavoriteCanvas,
  type FavoriteNote,
} from "@/context/favoritesCacheStore";
import Link from "next/link";

type FavoriteItem = {
  id: string;
  type: "note" | "canvas";
  itemId: string;
  title: string;
  createdAt: number;
  url: string;
};

const EMPTY_NOTES: FavoriteNote[] = [];
const EMPTY_CANVASES: FavoriteCanvas[] = [];

// Module-level tracker: survives the mobile sidebar unmounting/remounting, so
// opening the sidebar again does not trigger another favorites request unless
// a favorite was actually changed (refreshSignal) or the cache is missing.
let lastFetchedSignal: number | null = null;

export function NavDocuments({
  userId,
}: {
  items?: {
    name: string;
    url: string;
    icon: Icon;
  }[];
  userId: string;
}) {
  const refreshSignal = useFavNotificationStore(
    (state) => state.refreshFavSignal,
  );

  // Read the shared favorites cache instead of keeping a private copy. This
  // makes the sidebar render instantly from cached data and share fetches with
  // the favorites page / notes pages.
  const favoriteNotes = useFavoritesCacheStore((state) =>
    state.listsUserId === userId ? state.notes : EMPTY_NOTES,
  );
  const favoriteCanvases = useFavoritesCacheStore((state) =>
    state.listsUserId === userId ? state.canvases : EMPTY_CANVASES,
  );

  const favorites = useMemo<FavoriteItem[]>(() => {
    const notes: FavoriteItem[] = favoriteNotes.map((f) => ({
      id: f.id,
      type: "note" as const,
      itemId: f.noteId,
      title: f.note?.title ?? "Untitled",
      createdAt: f.createdAt ? new Date(f.createdAt).getTime() : 0,
      url: `/dashboard/notes/${f.noteId}`,
    }));

    const canvases: FavoriteItem[] = favoriteCanvases.map((f) => ({
      id: f.id,
      type: "canvas" as const,
      itemId: f.canvasId,
      title: f.canvas?.title ?? "Untitled board",
      createdAt: f.createdAt ? new Date(f.createdAt).getTime() : 0,
      url: `/dashboard/canvas?board=${f.canvasId}`,
    }));

    return [...notes, ...canvases];
  }, [favoriteNotes, favoriteCanvases]);

  useEffect(() => {
    if (!userId) return;

    const cache = useFavoritesCacheStore.getState();
    const hasFullCache =
      cache.listsUserId === userId && cache.fetchedAt > 0;
    const signal = useFavNotificationStore.getState().refreshFavSignal;

    // Already fetched for this user and no favorite changed since then.
    if (hasFullCache && lastFetchedSignal === signal) return;

    let cancelled = false;
    const fetchFavorites = async () => {
      try {
        const [notesRes, canvasesRes] = await Promise.all([
          fetch(`/api/favorite?userId=${userId}`),
          fetch(`/api/favorite-canvas?userId=${userId}`),
        ]);

        if (!notesRes.ok || !canvasesRes.ok) {
          throw new Error("Failed to load favorites");
        }

        const noteFavs: FavoriteNote[] = (await notesRes.json()) ?? [];
        const canvasFavs: FavoriteCanvas[] = (await canvasesRes.json()) ?? [];
        if (cancelled) return;

        useFavoritesCacheStore
          .getState()
          .setFavorites(userId, noteFavs, canvasFavs);
        lastFetchedSignal = signal;
      } catch {
        // Keep previously cached favorites visible instead of clearing them.
      }
    };

    fetchFavorites();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshSignal]);

  // Take only the latest 4 favorites to show in sidebar, newest first
  const latestFavorites = [...favorites]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 4);

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>⭐ Favorite</SidebarGroupLabel>
      <SidebarMenu>
        {latestFavorites.map((fav) => (
          <SidebarMenuItem key={fav.id}>
            <SidebarMenuButton asChild>
              <Link href={fav.url} className="flex items-center gap-2">
                <span className="truncate">{fav.title}</span>
                {fav.type === "canvas" && (
                  <span className="ml-auto shrink-0 inline-flex h-5 items-center justify-center rounded-md border border-border bg-card px-1.5 text-[10px] leading-none font-medium uppercase tracking-wide text-muted-foreground">
                    <span className="-mr-[0.1em] pt-px">canvas</span>
                  </span>
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}

        <SidebarMenuItem>
          <SidebarMenuButton asChild className="text-sidebar-foreground/70">
            {/* Link to a dedicated favorites page */}
            <Link
              href="/dashboard/favorites"
              className="flex items-center gap-2 text-sidebar-foreground/70"
            >
              <IconDots className="text-sidebar-foreground/70" />
              <span>More</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
