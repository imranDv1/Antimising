// context/noteBodyCacheStore.ts
import { create } from "zustand";

type NotePermission = "owner" | "read" | "write";

export interface CachedNoteBody {
  noteId: string;
  userId: string;
  notebody: {
    id: string;
    content: unknown;
    links: unknown[];
    images: unknown[];
  } | null;
  noteTitle: string;
  permission: NotePermission;
  isOwner: boolean;
  shareCount: number;
  ownerName: string | null;
  ownerEmail: string | null;
  updatedAt: string;
  fetchedAt: number;
}

interface NoteBodyCacheState {
  cache: Record<string, CachedNoteBody>;
  set: (entry: CachedNoteBody) => void;
  remove: (noteId: string) => void;
  clear: () => void;
}

// Module-level cache so a recently opened note body is served instantly
// without refetching. The server's `updatedAt` is used to revalidate: if the
// note did not change, the cached body stays and no heavy fetch happens.
export const useNoteBodyCacheStore = create<NoteBodyCacheState>((set) => ({
  cache: {},
  set: (entry) =>
    set((state) => ({ cache: { ...state.cache, [entry.noteId]: entry } })),
  remove: (noteId) =>
    set((state) => {
      const next = { ...state.cache };
      delete next[noteId];
      return { cache: next };
    }),
  clear: () => set({ cache: {} }),
}));

export function resetNoteBodyCache() {
  useNoteBodyCacheStore.setState({ cache: {} });
}