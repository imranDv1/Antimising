// context/sharedCacheStore.ts
import { create } from "zustand";
import type { Note } from "@/components/note-card";

interface SharedCacheState {
  userId: string | null;
  notes: Note[];
  unreadCount: number;
  fetchedAt: number;
  set: (userId: string, notes: Note[], unreadCount: number) => void;
  markRead: (noteId: string) => void;
  remove: (noteId: string) => void;
  clear: () => void;
}

// Snapshot of the "Shared with me" page so navigating away and back does not
// refetch. The unread badge stays accurate because markRead() is called from
// the note page when the shared note is opened.
export const useSharedCacheStore = create<SharedCacheState>((set) => ({
  userId: null,
  notes: [],
  unreadCount: 0,
  fetchedAt: 0,
  set: (userId, notes, unreadCount) =>
    set({ userId, notes, unreadCount, fetchedAt: Date.now() }),
  markRead: (noteId) =>
    set((state) => {
      if (!state.userId) return state;
      const wasUnread = state.notes.some((n) => n.id === noteId && !n.isRead);
      if (!wasUnread) return state;
      return {
        notes: state.notes.map((n) =>
          n.id === noteId ? { ...n, isRead: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    }),
  remove: (noteId) =>
    set((state) => {
      const target = state.notes.find((n) => n.id === noteId);
      if (!target) return state;
      return {
        notes: state.notes.filter((n) => n.id !== noteId),
        unreadCount: Math.max(
          0,
          state.unreadCount - (target.isRead ? 0 : 1)
        ),
      };
    }),
  clear: () =>
    set({ userId: null, notes: [], unreadCount: 0, fetchedAt: 0 }),
}));