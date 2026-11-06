"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, Loader2, Star, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export type Note = {
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
  isRead?: boolean;
};

// ─── Tag styling (unified, theme-aware) ────────────────────────────────────────
export function getTagColor(tag: string) {
  const idx =
    tag
      .split("")
      .reduce((acc, c) => acc + c.charCodeAt(0), 0) % 6;
  return [
    "bg-secondary/80 text-secondary-foreground border-border hover:bg-secondary",
    "bg-muted text-muted-foreground border-border hover:bg-muted/80",
    "bg-accent/10 text-accent-foreground border-border hover:bg-accent/20",
    "bg-background text-muted-foreground border-border hover:bg-muted/60",
    "bg-secondary text-secondary-foreground border-border hover:bg-secondary/90",
    "bg-muted/90 text-muted-foreground border-border hover:bg-muted",
  ][idx];
}

// ─── Favorites always on top ────────────────────────────────────────────────
export function sortFavoritesFirst(list: Note[], favMap: Record<string, boolean>) {
  const byUpdatedDesc = (a: Note, b: Note) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  const favorites = list.filter((n) => favMap[n.id]).sort(byUpdatedDesc);
  const others = list.filter((n) => !favMap[n.id]).sort(byUpdatedDesc);
  return [...favorites, ...others];
}

// ─── Sticky Note Card ─────────────────────────────────────────────────────────
export const NoteCard = ({
  note,
  favoriteStatus,
  favoriteLoading,
  deleteLoading,
  openingNoteId,
  onFavorite,
  onDelete,
  onEdit,
  onTagClick,
  onOpen,
  clickableTags = false,
  isNew = false,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: {
  note: Note;
  favoriteStatus: Record<string, boolean>;
  favoriteLoading: Record<string, boolean>;
  deleteLoading: string | null;
  openingNoteId: string | null;
  onFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (note: Note) => void;
  onTagClick?: (tag: string) => void;
  onOpen?: (id: string) => void;
  clickableTags?: boolean;
  isNew?: boolean;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) => {
  const isShared = note.permission === "read" || note.permission === "write";

  return (
    <div
      onClick={selectionMode ? () => onToggleSelect?.(note.id) : undefined}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-none border border-border bg-card/95 text-card-foreground shadow-sm transition-all hover:shadow-md dark:bg-card/90",
        selectionMode && "cursor-pointer",
        selectionMode && selected && "border-primary bg-primary/5 ring-1 ring-primary"
      )}
    >
      {/* Subtle top accent */}
      <div className="h-1 w-full" />

      {/* Card body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Header: title + star / selection checkbox */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 flex-1 text-base font-semibold leading-snug text-foreground">
            {isNew && (
              <span className="mr-1.5 inline-flex shrink-0 rounded-full bg-primary px-2 py-0.5 align-middle text-[10px] font-semibold uppercase leading-none tracking-wide text-primary-foreground">
                New
              </span>
            )}
            {note.title}
          </h3>

          {selectionMode ? (
            <span
              className={cn(
                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border transition-colors",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/40 bg-transparent"
              )}
            >
              {selected && <Check className="size-3.5" />}
            </span>
          ) : (
            (!isShared || note.permission === "write") && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="mt-0.5 shrink-0 cursor-pointer rounded-md p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
                    disabled={favoriteLoading[note.id]}
                    onClick={() => onFavorite(note.id)}
                    aria-label={
                      favoriteStatus[note.id]
                        ? "Remove from favorites"
                        : "Add to favorites"
                    }
                  >
                    {favoriteLoading[note.id] ? (
                      <Loader2 className="size-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Star
                        className="size-4 transition-colors"
                        fill={favoriteStatus[note.id] ? "#FBBF24" : "none"}
                        color={favoriteStatus[note.id] ? "#F59E0B" : "#9CA3AF"}
                        stroke={favoriteStatus[note.id] ? "#F59E0B" : "#9CA3AF"}
                        strokeWidth={1.5}
                      />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {favoriteStatus[note.id] ? "Remove from favorites" : "Add to favorites"}
                </TooltipContent>
              </Tooltip>
            )
          )}
        </div>

        {/* Description */}
        <p className="line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
          {note.description}
        </p>

        {/* Tags */}
        {note.category.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {note.category.map((tag, index) => (
              <span
                key={`${note.id}-${index}`}
                onClick={() => clickableTags && onTagClick?.(tag)}
                className={`rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${getTagColor(
                  tag
                )} ${clickableTags ? "cursor-pointer select-none" : ""}`}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer: date + actions */}
      <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-2.5 dark:bg-muted/30">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {new Date(note.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year:
              new Date(note.updatedAt).getFullYear() !==
              new Date().getFullYear()
                ? "numeric"
                : undefined,
          })}

          {!isShared && (note.shareCount ?? 0) > 0 && (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/5 px-1.5 py-0.5 text-[11px] font-medium text-primary"
              title={`Shared with ${note.shareCount} people`}
            >
              <Users className="size-3" />
              Shared · {note.shareCount}
            </span>
          )}

          {isShared && (
            <span className="inline-flex items-center rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {note.permission === "write" ? "Can edit" : "Can view"}
            </span>
          )}
        </span>

        {!selectionMode && (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onOpen?.(note.id)}
              disabled={openingNoteId === note.id}
              className="flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {openingNoteId === note.id ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Opening...
                </>
              ) : (
                "Open"
              )}
            </button>

            {!isShared && (
              <button
                onClick={() => onEdit(note)}
                className="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                Edit
              </button>
            )}

            {isShared && note.permission === "write" && (
              <button
                onClick={() => onEdit(note)}
                className="cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                Edit
              </button>
            )}

            {isShared && note.permission === "read" && (
              <span className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
              View only
            </span>
            )}

            {!isShared && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onDelete(note.id)}
                    disabled={deleteLoading === note.id}
                    className="cursor-pointer rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
                    aria-label="Delete note"
                  >
                    {deleteLoading === note.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Delete note</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </div>
  );
};