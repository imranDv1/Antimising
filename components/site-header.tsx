"use client";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { usePathname } from "next/navigation";
import { AnimatedThemeToggler } from "./ui/animated-theme-toggler";
import * as React from "react";
import { authClient } from "@/lib/auth-client";
import { useNoteBodyCacheStore } from "@/context/noteBodyCacheStore";

export function SiteHeader() {
  const fullpath = usePathname();
  const segments = fullpath.split("/dashboard");
  let path = segments[1] || "";
  path = path.charAt(0).toUpperCase() + path.slice(1);

  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  const cachedTitle = useNoteBodyCacheStore(
    (s) => {
      const match = fullpath.match(/\/dashboard\/notes\/([^\/]+)/);
      const noteId = match?.[1];
      return noteId ? s.cache[noteId]?.noteTitle : null;
    },
  );
  const [noteTitle, setNoteTitle] = React.useState<string | null>(null);

  React.useEffect(() => {
    setNoteTitle(cachedTitle ?? null);
  }, [cachedTitle]);

  React.useEffect(() => {
    // If we are at /dashboard/notes/[id], fetch note title (cheap, no decrypt)
    const match = fullpath.match(/\/dashboard\/notes\/([^\/]+)/);
    const noteId = match?.[1];
    if (!noteId || !userId) {
      setNoteTitle(null);
      return;
    }
    // موجود في الكاش — لا داعي لأي طلب
    if (useNoteBodyCacheStore.getState().cache[noteId]) return;
    let aborted = false;
    (async () => {
      try {
        const res = await fetch("/api/notebody", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, noteId, metaOnly: true }),
        });
        const data = await res.json();
        if (!aborted && data?.success) {
          setNoteTitle(data.noteTitle || null);
        }
      } catch {
        if (!aborted) setNoteTitle(null);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [fullpath, userId]);

  return (
    <header className="flex h-(--header-height) min-w-0 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full min-w-0 items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="min-w-0 truncate text-base font-medium text-muted-foreground">
          {noteTitle ? noteTitle : `...${path}`}
        </h1>
   
      </div>
    </header>
  );
}
