"use client";

import { Skeleton } from "@/components/ui/skeleton";

const NoteCardSkeleton = () => (
  <div className="flex flex-col overflow-hidden rounded-none border border-border bg-card/95">
    <div className="h-1 w-full" />
    <div className="flex flex-1 flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-5 w-3/5" />
        <Skeleton className="size-6" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex flex-wrap gap-1.5">
        <Skeleton className="h-5 w-14" />
        <Skeleton className="h-5 w-14" />
      </div>
    </div>
    <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-2.5 dark:bg-muted/30">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-16" />
    </div>
  </div>
);

const NotesLoadingSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className="mt-4 flex w-full flex-col gap-6">
    {/* Header: title + count pill + action button (row 1), search (row 2) */}
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-10 w-full sm:max-w-md" />
    </div>

    {/* Cards */}
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <NoteCardSkeleton key={i} />
      ))}
    </div>
  </div>
);

export default NotesLoadingSkeleton;