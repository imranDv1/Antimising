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
import { Loader2, Mail, Share2, Trash2, Users } from "lucide-react";
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

  // Exact-email sharing: the recipient is resolved once, on submit.
  const [email, setEmail] = React.useState("");
  const [emailError, setEmailError] = React.useState<string | null>(null);
  const [permission, setPermission] = React.useState<"read" | "write">("read");

  const [sharing, setSharing] = React.useState(false);
  const [updating, setUpdating] = React.useState<Record<string, boolean>>({});
  const [removing, setRemoving] = React.useState<Record<string, boolean>>({});

  const lower = noun.toLowerCase();
  const queryParam = (key: string, value: string) =>
    `${endpoint}?${encodeURIComponent(key)}=${encodeURIComponent(value)}`;

  // Load the people list whenever the dialog opens for an entity
  React.useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingShares(true);
    setPermission("read");
    setEmail("");
    setEmailError(null);
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

  const handleShare = async () => {
    const normalized = email.trim().toLowerCase();

    if (!normalized) {
      setEmailError("Enter the recipient's email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setEmailError("Enter a valid email address.");
      return;
    }

    setEmailError(null);
    setSharing(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [idParam]: entityId,
          email: normalized,
          permission,
        }),
      });

      if (!res.ok) {
        // "No account with that email", "not accepting shares", self-share…
        // The API message is already user-facing, so show it inline.
        setEmailError(await parseError(res, `Failed to share ${lower}`));
        return;
      }

      const data = await res.json();
      const share: ShareEntry = data.share;

      setShares((prev) => {
        const exists = prev.some((s) => s.user.id === share.user.id);
        return exists
          ? prev.map((s) => (s.user.id === share.user.id ? share : s))
          : [...prev, share];
      });
      toast.success(`${noun} shared with ${share.user.name}`);
      setEmail("");
      setPermission("read");
      onChanged?.();
    } catch (err) {
      setEmailError((err as Error).message);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <Share2 className="size-4 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Enter the email of the person you want to share this {lower} with.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-5">
          {/* ── Recipient email ──────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="email"
                inputMode="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (!sharing) void handleShare();
                  }
                }}
                autoComplete="email"
                spellCheck={false}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? "share-email-error" : undefined}
                className={cn(
                  "pl-9",
                  emailError && "border-destructive focus-visible:ring-destructive/40"
                )}
              />
            </div>

            <p className="px-1 text-xs text-muted-foreground">
              Use their full email address. We only look them up when you press
              {" "}
              {title}.
            </p>

            {emailError && (
              <p
                id="share-email-error"
                role="alert"
                className="px-1 text-sm text-destructive"
              >
                {emailError}
              </p>
            )}
          </div>

          {/* ── Permission ───────────────────────────────────────────── */}
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
            disabled={!email.trim() || sharing}
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
