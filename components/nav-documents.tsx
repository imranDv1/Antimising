"use client"

import {
  IconDots,
  type Icon,
} from "@tabler/icons-react"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useEffect, useState } from "react"
import { useFavNotificationStore } from "@/context/updateFavorite"
import Link from "next/link"

type FavoriteItem = {
  id: string
  type: "note" | "canvas"
  itemId: string
  title: string
  createdAt: number
  url: string
}

export function NavDocuments({
  userId,
}: {
  items?: {
    name: string
    url: string
    icon: Icon
  }[]
  userId: string
}) {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const refreshSignal = useFavNotificationStore((state) => state.refreshFavSignal)

  useEffect(() => {
    if (!userId) return
    const fetchFavorites = async () => {
      try {
        const [notesRes, canvasesRes] = await Promise.all([
          fetch(`/api/favorite?userId=${userId}`),
          fetch(`/api/favorite-canvas?userId=${userId}`),
        ])

        const noteFavs = notesRes.ok ? await notesRes.json() : []
        const canvasFavs = canvasesRes.ok ? await canvasesRes.json() : []

        const notes: FavoriteItem[] = (noteFavs ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (f: any) => ({
            id: f.id,
            type: "note" as const,
            itemId: f.noteId,
            title: f.note?.title ?? "Untitled",
            createdAt: f.createdAt ? new Date(f.createdAt).getTime() : 0,
            url: `/dashboard/notes/${f.noteId}`,
          })
        )

        const canvases: FavoriteItem[] = (canvasFavs ?? []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (f: any) => ({
            id: f.id,
            type: "canvas" as const,
            itemId: f.canvasId,
            title: f.canvas?.title ?? "Untitled board",
            createdAt: f.createdAt ? new Date(f.createdAt).getTime() : 0,
            url: `/dashboard/canvas?board=${f.canvasId}`,
          })
        )

        setFavorites([...notes, ...canvases])
      } catch {
        setFavorites([])
      }
    }
    fetchFavorites()
  }, [userId, refreshSignal])

  // Take only the latest 4 favorites to show in sidebar, newest first
  const latestFavorites = [...favorites]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 4)

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
                  <span className="ml-auto shrink-0 rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    canvas
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
  )
}