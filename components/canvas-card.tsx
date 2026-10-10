"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LayoutDashboard, Loader2, Star, Trash2 } from "lucide-react";

export type CanvasMeta = {
  id: string;
  title: string;
  userId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  permission?: "owner" | "read" | "write";
};

// ─── Sticky Board Card (mirrors NoteCard) ─────────────────────────────────────
export const CanvasCard = ({
  canvas,
  favoriteStatus,
  favoriteLoading,
  deleteLoading,
  openingCanvasId,
  onFavorite,
  onDelete,
  onOpen,
}: {
  canvas: CanvasMeta;
  favoriteStatus: Record<string, boolean>;
  favoriteLoading: Record<string, boolean>;
  deleteLoading: string | null;
  openingCanvasId: string | null;
  onFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onOpen: (id: string) => void;
}) => {
  const isShared =
    canvas.permission === "read" || canvas.permission === "write";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-none border border-border bg-card/95 text-card-foreground shadow-sm transition-all hover:shadow-md dark:bg-card/90">
      <div className="h-1 w-full" />

      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Header: title + star */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 flex-1 text-base font-semibold leading-snug text-foreground">
            {canvas.title}
          </h3>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="mt-0.5 shrink-0 rounded-md p-1 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
                disabled={favoriteLoading[canvas.id]}
                onClick={() => onFavorite(canvas.id)}
                aria-label={
                  favoriteStatus[canvas.id]
                    ? "Remove from favorites"
                    : "Add to favorites"
                }
              >
                {favoriteLoading[canvas.id] ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <Star
                    className="size-4 transition-colors"
                    fill={favoriteStatus[canvas.id] ? "#FBBF24" : "none"}
                    color="#F59E0B"
                    stroke="#F59E0B"
                    strokeWidth={1.5}
                  />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {favoriteStatus[canvas.id]
                ? "Remove from favorites"
                : "Add to favorites"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Type hint */}
        <p className="flex flex-1 items-center gap-1.5 text-sm leading-relaxed text-muted-foreground">
          <LayoutDashboard className="size-4" />
          Canvas board
        </p>
      </div>

      {/* Footer: date + actions */}
      <div className="flex items-center justify-between border-t border-border bg-muted/40 px-4 py-2.5 dark:bg-muted/30">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {new Date(canvas.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year:
              new Date(canvas.updatedAt).getFullYear() !==
              new Date().getFullYear()
                ? "numeric"
                : undefined,
          })}

          {isShared && (
            <span className="inline-flex items-center rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {canvas.permission === "write" ? "Can edit" : "Can view"}
            </span>
          )}
        </span>

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onOpen(canvas.id)}
            disabled={openingCanvasId === canvas.id}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {openingCanvasId === canvas.id ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Opening...
              </>
            ) : (
              "Open"
            )}
          </button>

          {!isShared && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onDelete(canvas.id)}
                  disabled={deleteLoading === canvas.id}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50"
                  aria-label="Delete board"
                >
                  {deleteLoading === canvas.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>Delete board</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
};
