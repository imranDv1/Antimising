"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  Share2,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────

type ShareUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
};

type ShareEntry = {
  id: string;
  permission: "read" | "write";
  createdAt: string;
  user: ShareUser;
};

type ShareDialogProps = {
  /** The note / board whose grants are being edited. */
  entityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
  /** Route that owns these grants, e.g. "/api/share". */
  endpoint: string;
  /** Query/body key that route expects for `entityId`, e.g. "noteId". */
  idParam: string;
  /** Dialog title and primary button label, e.g. "Share note". */
  title: string;
  /** Entity noun used in toasts and copy, e.g. "Note". */
  noun: string;
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

async function parseError(res: Response, fallback: string) {
  try {
    const data = await res.json();
    return data?.message || fallback;
  } catch {
    return fallback;
  }
}

// ─── Component ────────────────────────────────────────────────────────────

export function ShareDialog({
  entityId,
  open,
  onOpenChange,
  onChanged,
  endpoint,
  idParam,
  title,
  noun,
}: ShareDialogProps) {
  const [shares, setShares] = React.useState<ShareEntry[]>([]);
  const [loadingShares, setLoadingShares] = React.useState(false);

  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<ShareUser[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchStatus, setSearchStatus] = React.useState<
    "idle" | "empty" | "results"
  >("idle");
  const [selected, setSelected] = React.useState<ShareUser | null>(null);
  const [permission, setPermission] = React.useState<"read" | "write">("read");

  const [sharing, setSharing] = React.useState(false);
  const [updating, setUpdating] = React.useState<Record<string, boolean>>({});
  const [removing, setRemoving] = React.useState<Record<string, boolean>>({});

  const searchSeq = React.useRef(0);

  const lower = noun.toLowerCase();
  const queryParam = (key: string, value: string) =>
    `${endpoint}?${encodeURIComponent(key)}=${encodeURIComponent(value)}`;

  // Load the people list whenever the dialog opens for an entity
  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingShares(true);
    setSelected(null);
    setPermission("read");
    setQuery("");
    setResults([]);
    setSearchStatus("idle");
    setShares([]);

    fetch(queryParam(idParam, entityId))
      .then(async (res) => {
        if (!res.ok) throw new Error(await parseError(res, "Failed to load shares"));
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setShares(data.shares ?? []);
      })
      .catch((err) => {
        if (!cancelled) toast.error((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoadingShares(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entityId, endpoint, idParam]);

  // Debounced email search
  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchStatus(q.length > 0 ? "empty" : "idle");
      setSearching(false);
      return;
    }

    const seq = ++searchSeq.current;
    setSearching(true);
    setSearchStatus("idle");

    const timer = setTimeout(() => {
      fetch("/api/share/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(await parseError(res, "Search failed"));
          return res.json();
        })
        .then((data) => {
          if (seq !== searchSeq.current) return;
          const users: ShareUser[] = data.users ?? [];
          setResults(users);
          setSearchStatus(users.length ? "results" : "empty");
        })
        .catch((err) => {
          if (seq !== searchSeq.current) return;
          setResults([]);
          setSearchStatus("empty");
          toast.error((err as Error).message);
        })
        .finally(() => {
          if (seq === searchSeq.current) setSearching(false);
        });
    }, 350);

    return () => clearTimeout(timer);
  }, [query]);

  const selectUser = (user: ShareUser) => {
    setSelected(user);
    setResults([]);
    setQuery("");
    setSearchStatus("idle");
  };

  const handleShare = async () => {
    if (!selected) return;
    setSharing(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [idParam]: entityId,
          userId: selected.id,
          permission,
        }),
      });
      if (!res.ok) throw new Error(await parseError(res, `Failed to share ${lower}`));
      const data = await res.json();
      const share: ShareEntry = data.share;

      setShares((prev) => {
        const exists = prev.some((s) => s.user.id === selected.id);
        return exists
          ? prev.map((s) => (s.user.id === selected.id ? share : s))
          : [...prev, share];
      });
      toast.success(`${noun} shared with ${selected.name}`);
      setSelected(null);
      setPermission("read");
      onChanged?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSharing(false);
    }
  };

  const handlePermissionChange = async (entry: ShareEntry, value: "read" | "write") => {
    setUpdating((p) => ({ ...p, [entry.user.id]: true }));
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [idParam]: entityId, userId: entry.user.id, permission: value }),
      });
      if (!res.ok) throw new Error(await parseError(res, "Failed to update permission"));
      const data = await res.json();
      const updated: ShareEntry = data.share;
      setShares((prev) =>
        prev.map((s) => (s.user.id === entry.user.id ? updated : s))
      );
      toast.success("Permission updated");
      onChanged?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUpdating((p) => ({ ...p, [entry.user.id]: false }));
    }
  };

  const handleRemove = async (entry: ShareEntry) => {
    setRemoving((p) => ({ ...p, [entry.user.id]: true }));
    try {
      const res = await fetch(
        `${queryParam(idParam, entityId)}&userId=${encodeURIComponent(entry.user.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(await parseError(res, "Failed to remove access"));
      setShares((prev) => prev.filter((s) => s.user.id !== entry.user.id));
      toast.success("Access removed");
      onChanged?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRemoving((p) => ({ ...p, [entry.user.id]: false }));
    }
  };

  const selectedIds = React.useMemo(
    () => new Set(shares.map((s) => s.user.id)),
    [shares]
  );
  const visibleResults = React.useMemo(
    () =>
      results.filter(
        (u) => u.id !== selected?.id && !selectedIds.has(u.id)
      ),
    [results, selected, selectedIds]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Share2 className="size-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Choose who can access this {lower} and what they can do.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-5">
          {/* ── Search by email ──────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by email..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                className="pl-9 pr-9"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {searching && (
              <div className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Searching…
              </div>
            )}

            {!searching && searchStatus === "empty" && (
              <p className="px-1 text-sm text-muted-foreground">
                No users found. Try a different email.
              </p>
            )}

            {visibleResults.length > 0 && (
              <ul className="space-y-1">
                {visibleResults.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => selectUser(user)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      <Avatar className="size-8">
                        <AvatarImage src={user.image ?? undefined} alt={user.name} />
                        <AvatarFallback className="text-xs">
                          {initials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {user.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      </span>
                      <UserPlus className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ── Selected user + permission ───────────────────────────── */}
          {selected && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <Avatar className="size-8">
                  <AvatarImage src={selected.image ?? undefined} alt={selected.name} />
                  <AvatarFallback className="text-xs">
                    {initials(selected.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {selected.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {selected.email}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Deselect user"
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/20 hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div role="radiogroup" aria-label="Permission" className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Permission
                </p>
                {(
                  [
                    { value: "read" as const, label: "Can view", hint: `Can read this ${lower} but cannot make changes.` },
                    { value: "write" as const, label: "Can edit", hint: `Can read and modify this ${lower}.` },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={permission === opt.value}
                    onClick={() => setPermission(opt.value)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                      permission === opt.value
                        ? "border-primary/50 bg-primary/5"
                        : "border-border hover:bg-accent/10"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border",
                        permission === opt.value
                          ? "border-primary"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {permission === opt.value && (
                        <span className="size-2 rounded-full bg-primary" />
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-foreground">
                        {opt.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {opt.hint}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── People with access ───────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 border-t border-border pt-4">
              <Users className="size-4 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">
                People with access
              </p>
            </div>

            {loadingShares ? (
              <div className="flex items-center gap-2 px-1 py-1 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : shares.length === 0 ? (
              <p className="px-1 py-1 text-sm text-muted-foreground">
                No one has access to this {lower} yet.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {shares.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <Avatar className="size-8">
                      <AvatarImage src={entry.user.image ?? undefined} alt={entry.user.name} />
                      <AvatarFallback className="text-xs">
                        {initials(entry.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">
                        {entry.user.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {entry.user.email}
                      </span>
                    </span>

                    <Select
                      value={entry.permission}
                      onValueChange={(v) =>
                        handlePermissionChange(entry, v as "read" | "write")
                      }
                      disabled={!!updating[entry.user.id]}
                    >
                      <SelectTrigger size="sm" className="w-[112px]" aria-label="Permission">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="end">
                        <SelectItem value="read">Can view</SelectItem>
                        <SelectItem value="write">Can edit</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(entry)}
                      disabled={!!removing[entry.user.id]}
                      aria-label={`Remove ${entry.user.name}`}
                      className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      {removing[entry.user.id] ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sharing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleShare}
            disabled={!selected || sharing}
            className="bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {sharing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Sharing…
              </span>
            ) : (
              <>
                <Share2 className="mr-1.5 size-4" /> {title}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ShareNoteDialog({
  noteId,
  ...rest
}: {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  return (
    <ShareDialog
      {...rest}
      entityId={noteId}
      endpoint="/api/share"
      idParam="noteId"
      title="Share note"
      noun="Note"
    />
  );
}

export function ShareCanvasDialog({
  canvasId,
  ...rest
}: {
  canvasId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  return (
    <ShareDialog
      {...rest}
      entityId={canvasId}
      endpoint="/api/canvas/share"
      idParam="canvasId"
      title="Share board"
      noun="Board"
    />
  );
}
