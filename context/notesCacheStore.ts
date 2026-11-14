// context/notesCacheStore.ts
import { create } from "zustand";
import type { Note } from "@/components/note-card";

export interface NotesSnapshot {
  notes: Note[];
  totalCount: number;
  hasMore: boolean;
  page: number;
  noteLimit: number | null;
}

interface NotesCacheState extends NotesSnapshot {
  userId: string | null;
  setSnapshot: (userId: string, snapshot: NotesSnapshot) => void;
  removeNote: (noteId: string) => void;
  markRead: (noteId: string) => void;
}

function emptySnapshot(): NotesSnapshot {
  return { notes: [], totalCount: 0, hasMore: false, page: 1, noteLimit: null };
}

// Module-level cache so the All Notes list survives client-side navigation
// (opening a note, going to settings, etc.) without refetching. The list is
// only replaced when the refresh signal fires after the page is mounted.
export const useNotesCacheStore = create<NotesCacheState>((set) => ({
  ...emptySnapshot(),
  userId: null,
  setSnapshot: (userId, snapshot) =>
    set({ ...snapshot, userId }),
  // Used when a shared note is rejected from the "Shared with me" page so it
  // disappears from All Notes without a refetch.
  removeNote: (noteId) =>
    set((state) => ({ notes: state.notes.filter((n) => n.id !== noteId) })),
  // Opening a shared note marks it read server-side; reflect that in the list.
  markRead: (noteId) =>
    set((state) => {
      const target = state.notes.find((n) => n.id === noteId);
      if (!target || target.isRead) return state;
      return {
        notes: state.notes.map((n) =>
          n.id === noteId ? { ...n, isRead: true } : n
        ),
      };
    }),
}));

export function resetNotesCache() {
  useNotesCacheStore.setState({ ...emptySnapshot(), userId: null });
}