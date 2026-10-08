/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FilePlus2, Loader2, Search, X, BookOpen, ArrowLeft } from "lucide-react";
import {
  Note,
  NoteCard,
  getTagColor,
  sortFavoritesFirst,
} from "@/components/note-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useDialog } from "@/context/CreateDialogContext";
import { useNoteNotificationStore } from "@/context/notesUpateStore";
import { useFavNotificationStore } from "@/context/updateFavorite";
import { CreateNote } from "./action";

// ─── Constants & Types ────────────────────────────────────────────────────────

const formSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(3),
  category: z
    .array(z.string())
    .min(0, "Enter at least 1 tag")
    .max(3, "Max 3 tags allowed"),
});

const UNSAVED_MESSAGE =
  "You have unsaved changes. Are you sure you want to discard them?";

type CreateNotesProps = {
  notes: Note[];
  totalCount?: number;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const ConfirmDeleteDialog = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}) => (
  <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-sm" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
        <DialogTitle className="text-lg font-semibold ">
          Delete this note?
        </DialogTitle>
        <DialogDescription className="mt-1 text-sm text-muted-foreground">
          This action cannot be undone. The note will be permanently removed.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="flex gap-2 mt-4">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={loading}
          className="flex-1 "
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Deleting…
            </span>
          ) : (
            "Delete"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

// ─── Sticky Note Card ─────────────────────────────────────────────────────────
// ─── Tag Input shared component ───────────────────────────────────────────────
const TagInput = ({
  tags,
  inputValue,
  maxTags,
  onInputChange,
  onKeyDown,
  onRemove,
}: {
  tags: string[];
  inputValue: string;
  maxTags: number;
  onInputChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onRemove: (tag: string) => void;
}) => (
  <div className="space-y-2">
    <Input
      placeholder={
        tags.length >= maxTags ? "Max tags reached" : "Type a tag, press Enter"
      }
      type="text"
      value={inputValue}
      onChange={(e) => onInputChange(e.target.value)}
      onKeyDown={onKeyDown}
      disabled={tags.length >= maxTags}
      className="text-sm"
      autoComplete="off"
      spellCheck={false}
    />
    {tags.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, idx) => (
          <span
            key={idx}
            className={`flex items-center gap-1 text-xs px-2.5 py-0.5  border font-medium ${getTagColor(
              tag
            )}`}
          >
            #{tag}
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className="hover:opacity-70 transition-opacity ml-0.5"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
    )}
    <p className="text-xs text-muted-foreground">
      {tags.length}/{maxTags} tags used
    </p>
  </div>
);

// ─── Shared dialog form fields ──────────────────────────────────────────────
const NoteFormFields = ({
  currentForm,
  submitLabel,
  loading,
  tags,
  inputValue,
  maxTags,
  onInputChange,
  onKeyDown,
  onRemove,
}: {
  currentForm: ReturnType<typeof useForm<z.infer<typeof formSchema>>>;
  submitLabel: string;
  loading: boolean;
  tags: string[];
  inputValue: string;
  maxTags: number;
  onInputChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onRemove: (tag: string) => void;
}) => (
  <div className="space-y-4">
    <FormField
      control={currentForm.control}
      name="title"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-medium ">Title</FormLabel>
          <FormControl>
            <Input
              placeholder="What's this note about?"
              {...field}
              autoComplete="off"
              spellCheck={false}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={currentForm.control}
      name="description"
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-sm font-medium ">Description</FormLabel>
          <FormControl>
            <Textarea
              placeholder="Jot down your thoughts…"
              {...field}
              rows={4}
              className="resize-none"
              spellCheck={false}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <FormField
      control={currentForm.control}
      name="category"
      render={() => (
        <FormItem>
          <FormLabel className="text-sm font-medium ">Tags</FormLabel>
          <FormControl>
            <TagInput
              tags={tags}
              inputValue={inputValue}
              maxTags={maxTags}
              onInputChange={onInputChange}
              onKeyDown={onKeyDown}
              onRemove={onRemove}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
    <Button
      type="submit"
      disabled={loading}
      className="w-full  bg-primary cursor-pointer font-semibold"
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" /> Saving…
        </span>
      ) : (
        submitLabel
      )}
    </Button>
  </div>
);

// ─── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = ({ onOpen }: { onOpen: () => void }) => (
  <div className="col-span-full flex flex-col items-center justify-center gap-4 py-20">
    <div className="relative">
      <div className="absolute -left-1 -top-1 size-20 rotate-3 rounded-lg border border-border bg-muted/70" />
      <div className="relative z-10 flex size-20 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
        <BookOpen className="size-9 text-primary" />
      </div>
    </div>
    <div className="mt-2 text-center">
      <p className="text-lg font-semibold text-foreground">No notes yet</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Create your first note to get started
      </p>
    </div>
    <Button
      onClick={onOpen}
      className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
    >
      <FilePlus2 className="mr-1.5 size-4" /> Create your first note
    </Button>
  </div>
);

// ─── Main Page ─────────────────────────────────────────────────────────────────
const CreateNotesPage = ({
  notes,
  totalCount = notes.length,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
}: CreateNotesProps) => {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [noteToEdit, setNoteToEdit] = useState<Note | null>(null);
  const [searchValue, setSearch] = useState("");
  const [favoriteStatus, setFavoriteStatus] = useState<Record<string, boolean>>({});
  const [favoriteLoading, setFavoriteLoading] = useState<Record<string, boolean>>({});
  const [searchResults, setSearchResults] = useState<Note[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [categorysearchResults, setcategorySearchResults] = useState<Note[]>([]);
  const [hasCategorySearched, setHasCategorySearched] = useState(false);
  const [openingNoteId, setOpeningNoteId] = useState<string | null>(null);

  const { isDialogOpen, openDialog, closeDialog } = useDialog();
  const maxTags = 3;
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;

  const triggerRefresh = useNoteNotificationStore((s) => s.triggerRefresh);
  const triggerFavRefresh = useFavNotificationStore((s) => s.triggerFavRefresh);

  // ── Forms ──────────────────────────────────────────────────────────────────

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", category: [] },
  });

  const editForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { title: "", description: "", category: [] },
  });

  // ── Unsaved-changes guards ────────────────────────────────────────────────

  const editBaselineRef = useRef<{
    title: string;
    description: string;
    category: string[];
  } | null>(null);

  const isCreateDirty = useCallback(() => {
    const v = form.getValues();
    return Boolean(
      v.title ||
        v.description ||
        v.category?.length ||
        tags.length ||
        inputValue.trim()
    );
  }, [form, tags, inputValue]);

  const isEditDirty = useCallback(() => {
    const b = editBaselineRef.current;
    if (!b) return false;
    const v = editForm.getValues();
    return (
      v.title !== b.title ||
      v.description !== b.description ||
      JSON.stringify(v.category) !== JSON.stringify(b.category) ||
      JSON.stringify(tags) !== JSON.stringify(b.category) ||
      Boolean(inputValue.trim())
    );
  }, [editForm, tags, inputValue]);

  const requestCloseCreate = () => {
    if (isCreateDirty() && !window.confirm(UNSAVED_MESSAGE)) return;
    closeDialog();
    form.reset();
    setTags([]);
    setInputValue("");
  };

  const requestCloseEdit = () => {
    if (isEditDirty() && !window.confirm(UNSAVED_MESSAGE)) return;
    setEditDialogOpen(false);
    setTags([]);
    setInputValue("");
  };

  useEffect(() => {
    if (!isDialogOpen && !editDialogOpen) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const dirty = isDialogOpen ? isCreateDirty() : isEditDirty();
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDialogOpen, editDialogOpen, isCreateDirty, isEditDirty]);

  // ── Tag helpers ────────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (newTag && tags.length < maxTags && !tags.includes(newTag)) {
        const updated = [...tags, newTag];
        setTags(updated);
        form.setValue("category", updated);
        editForm.setValue("category", updated);
        setInputValue("");
      }
    }

    if (e.key === "Backspace" && !inputValue) {
      const updated = tags.slice(0, -1);
      setTags(updated);
      form.setValue("category", updated);
      editForm.setValue("category", updated);
    }
  };

  const removeTag = (tag: string) => {
    const updated = tags.filter((t) => t !== tag);
    setTags(updated);
    form.setValue("category", updated);
    editForm.setValue("category", updated);
  };

  // ── Create ─────────────────────────────────────────────────────────────────

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    const newTag = inputValue.trim();
    if (newTag && tags.length < maxTags && !tags.includes(newTag)) {
      const updated = [...tags, newTag];
      setTags(updated);
      values.category = updated;
      setInputValue("");
    }
    const result = await CreateNote({ ...values, userId });
    if (result.success) {
      toast.success("Note created");
      form.reset();
      setTags([]);
      closeDialog();
      triggerRefresh();
    } else {
      toast.error(result.message || "Failed to create note");
    }
    setLoading(false);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDeleteClick = (noteId: string) => {
    setNoteToDelete(noteId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!noteToDelete) return;
    setDeleteLoading(noteToDelete);
    try {
      const res = await fetch(`/api/create/${noteToDelete}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete note");
      toast.success("Note deleted");
      triggerRefresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setDeleteLoading(null);
      setDeleteDialogOpen(false);
      setNoteToDelete(null);
    }
  };

  // ── Favorites ──────────────────────────────────────────────────────────────

  const handleFavoriteToggle = async (noteId: string) => {
    if (!userId) return;
    setFavoriteLoading((p) => ({ ...p, [noteId]: true }));
    try {
      const isFav = favoriteStatus[noteId] ?? false;
      const res = await fetch("/api/favorite", {
        method: isFav ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, noteId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Request failed");
      setFavoriteStatus((p) => ({ ...p, [noteId]: !isFav }));
      toast.success(isFav ? "Removed from favorites" : "Added to favorites");
      triggerFavRefresh();
      triggerRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setFavoriteLoading((p) => ({ ...p, [noteId]: false }));
    }
  };

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/favorite?userId=${userId}`)
      .then((r) => r.json())
      .then((favs: any[]) => {
        const map: Record<string, boolean> = {};
        favs.forEach((f) => (map[f.noteId] = true));
        setFavoriteStatus(map);
      })
      .catch(console.error);
  }, [userId]);

  // ── Edit ───────────────────────────────────────────────────────────────────

  const handleEditClick = (note: Note) => {
    setNoteToEdit(note);
    editForm.reset({ title: note.title, description: note.description, category: note.category });
    setTags(note.category);
    editBaselineRef.current = {
      title: note.title,
      description: note.description,
      category: [...note.category],
    };
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (values: z.infer<typeof formSchema>) => {
    const newTag = inputValue.trim();
    if (newTag && tags.length < maxTags && !tags.includes(newTag)) {
      const updated = [...tags, newTag];
      setTags(updated);
      values.category = updated;
      setInputValue("");
    }
    if (!noteToEdit) return;
    setLoading(true);
    try {
      const res = await fetch("/api/create/editNote", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, id: noteToEdit.id, userId }),
      });
      if (!res.ok) throw new Error("Failed to update note");
      toast.success("Note updated");
      setEditDialogOpen(false);
      triggerRefresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // ── Search ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) {
      setHasSearched(false);
      setHasCategorySearched(false);
      setSearchResults([]);
      return;
    }
    setHasSearched(true);
    setHasCategorySearched(false);
    setSearchResults(
      notes.filter(
        (n) =>
          n.title?.toLowerCase().includes(q) ||
          n.description?.toLowerCase().includes(q) ||
          (n.category || []).some((t) => t.toLowerCase().includes(q))
      )
    );
  }, [searchValue, notes]);

  const handleCategorySearch = (category: string) => {
    if (!userId) return;
    setHasCategorySearched(true);
    setHasSearched(false);
    setSearch("");
    setcategorySearchResults(
      notes.filter((n) =>
        (n.category || []).some((t) => t.toLowerCase() === category.toLowerCase())
      )
    );
  };

  const handleOpenNote = (noteId: string) => {
    if (openingNoteId) return;
    setOpeningNoteId(noteId);
    router.push(`/dashboard/notes/${noteId}`);
  };

  const handleBackToNotes = () => {
    setSearch("");
    setHasSearched(false);
    setHasCategorySearched(false);
    setcategorySearchResults([]);
  };

  // ── Decide which notes to render ───────────────────────────────────────────
  const baseDisplayedNotes = hasSearched
    ? searchResults
    : hasCategorySearched
    ? categorysearchResults
    : notes;

  const displayedNotes = sortFavoritesFirst(baseDisplayedNotes, favoriteStatus);

  const isFiltered = hasSearched || hasCategorySearched;

  // ── Infinite scroll ──────────────────────────────────────────────────────
  const loadMoreSentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!onLoadMore || !hasMore || loadingMore || isFiltered) return;
    const el = loadMoreSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      { rootMargin: "400px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onLoadMore, hasMore, loadingMore, isFiltered, notes.length]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full flex flex-col gap-6 mt-4">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">
              My Notebooks
            </h1>
            <Badge
              variant="secondary"
              className="rounded-full px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
            >
              {totalCount} note{totalCount !== 1 ? "s" : ""}
            </Badge>
          </div>

          <Button
            onClick={openDialog}
            className="shrink-0 bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <FilePlus2 className="mr-1.5 size-4" /> New Note
          </Button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search notes…"
            value={searchValue}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-9 pr-9"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Filter banner ────────────────────────────────────────────────── */}
      {isFiltered && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm dark:bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              Showing{" "}
              {hasSearched ? searchResults.length : categorysearchResults.length}{" "}
              of {notes.length} notes
            </span>
            {hasCategorySearched && (
              <Badge variant="secondary" className="gap-1 pr-1">
                #{searchValue}
                <button
                  onClick={handleBackToNotes}
                  className="ml-0.5 rounded-sm p-0.5 hover:bg-accent/20"
                  aria-label="Clear tag filter"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            )}
            {hasSearched && (
              <span className="text-muted-foreground">
                for{" "}
                <span className="font-semibold text-foreground">
                  &ldquo;{searchValue}&rdquo;
                </span>
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToNotes}
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 size-3.5" />
            All notes
          </Button>
        </div>
      )}

      {/* ── Notes grid ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 pb-10 gap-4">
        {displayedNotes.length === 0 && !isFiltered ? (
          <EmptyState onOpen={openDialog} />
        ) : displayedNotes.length === 0 && isFiltered ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-foreground">
              No notes match your search
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different keyword or clear the filter
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToNotes}
              className="mt-3"
            >
              Clear filters
            </Button>
          </div>
        ) : (
          displayedNotes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              favoriteStatus={favoriteStatus}
              favoriteLoading={favoriteLoading}
              deleteLoading={deleteLoading}
              openingNoteId={openingNoteId}
              onFavorite={handleFavoriteToggle}
              onDelete={handleDeleteClick}
              onEdit={handleEditClick}
              onTagClick={handleCategorySearch}
              onOpen={handleOpenNote}
              clickableTags={!isFiltered}
            />
          ))
        )}
      </div>

      {/* ── Infinite scroll sentinel / loader ──────────────────────────── */}
      {!isFiltered && notes.length > 0 && (
        <div
          ref={loadMoreSentinelRef}
          className="flex min-h-14 items-center justify-center gap-2 py-2"
        >
          {loadingMore ? (
            <>
              <Loader2 className="size-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">
                Loading more notes…
              </span>
            </>
          ) : !hasMore && totalCount > 10 ? (
            <span className="text-sm text-muted-foreground/70">
              You&apos;re all caught up
            </span>
          ) : null}
        </div>
      )}

      {/* ── Create Note Dialog ────────────────────────────────────────────── */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) requestCloseCreate();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              New Note
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Capture your thoughts, ideas, or reminders.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-2">
              <NoteFormFields
                currentForm={form}
                submitLabel="Create Note"
                loading={loading}
                tags={tags}
                inputValue={inputValue}
                maxTags={maxTags}
                onInputChange={setInputValue}
                onKeyDown={handleKeyDown}
                onRemove={removeTag}
              />
            </form>
          </Form>

          <button
            onClick={requestCloseCreate}
            className="mt-1 w-full text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        </DialogContent>
      </Dialog>

      {/* ── Edit Note Dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (!open) requestCloseEdit();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              Edit Note
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Update your note details.
            </DialogDescription>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="mt-2">
              <NoteFormFields
                currentForm={editForm}
                submitLabel="Save Changes"
                loading={loading}
                tags={tags}
                inputValue={inputValue}
                maxTags={maxTags}
                onInputChange={setInputValue}
                onKeyDown={handleKeyDown}
                onRemove={removeTag}
              />
            </form>
          </Form>

          <button
            onClick={requestCloseEdit}
            className="mt-1 w-full text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Delete Dialog ─────────────────────────────────────────── */}
      <ConfirmDeleteDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        loading={deleteLoading !== null}
      />
    </div>
  );
};

export default CreateNotesPage;
