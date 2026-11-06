// context/favoritesCacheStore.ts
import { create } from "zustand";

export type FavoriteNote = {
  id: string;
  userId: string;
  noteId: string;
  createdAt: Date;
  note: {
    id: string;
    title: string;
    description: string;
    category: string[];
    createdAt: Date;
    updatedAt: Date;
    userId: string;
  };
};

export type FavoriteCanvas = {
  id: string;
  userId: string;
  canvasId: string;
  createdAt: string;
  permission?: "owner" | "read" | "write";
  canvas: {
    id: string;
    title: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
  };
};

interface FavoritesCacheState {
  userId: string | null;
  // Which user the `notes`/`canvases` lists belong to. Kept separate from
  // `userId` because `userId` is also set by setStatus(), which only caches
  // favorite flags and does not load the full lists.
  listsUserId: string | null;
  status: Record<string, boolean>;
  notes: FavoriteNote[];
  canvases: FavoriteCanvas[];
  fetchedAt: number;
  setStatus: (userId: string, status: Record<string, boolean>) => void;
  toggle: (noteId: string, value: boolean) => void;
  setFavorites: (
    userId: string,
    notes: FavoriteNote[],
    canvases: FavoriteCanvas[]
  ) => void;
  setNotes: (userId: string, notes: FavoriteNote[]) => void;
  setCanvases: (userId: string, canvases: FavoriteCanvas[]) => void;
  addNote: (userId: string, fav: FavoriteNote) => void;
  removeNote: (userId: string, noteId: string) => void;
  addCanvas: (userId: string, fav: FavoriteCanvas) => void;
  removeCanvas: (userId: string, canvasId: string) => void;
  reset: () => void;
}

// Cache favorite flags per user so the "favorites on top" ordering is applied
// instantly on mount, plus a snapshot of the favorites page so navigation back
// to it does not refetch every time.
export const useFavoritesCacheStore = create<FavoritesCacheState>((set) => ({
  userId: null,
  listsUserId: null,
  status: {},
  notes: [],
  canvases: [],
  fetchedAt: 0,
  setStatus: (userId, status) => set({ userId, status }),
  toggle: (noteId, value) =>
    set((s) => ({ status: { ...s.status, [noteId]: value } })),
  setFavorites: (userId, notes, canvases) =>
    set({
      userId,
      listsUserId: userId,
      notes,
      canvases,
      fetchedAt: Date.now(),
    }),
  setNotes: (userId, notes) =>
    set((state) =>
      state.userId === userId
        ? { notes, listsUserId: userId, fetchedAt: Date.now() }
        : state
    ),
  setCanvases: (userId, canvases) =>
    set((state) =>
      state.userId === userId
        ? { canvases, listsUserId: userId, fetchedAt: Date.now() }
        : state
    ),
  addNote: (userId, fav) =>
    set((state) =>
      state.userId === userId
        ? { notes: [fav, ...state.notes.filter((n) => n.noteId !== fav.noteId)] }
        : state
    ),
  removeNote: (userId, noteId) =>
    set((state) =>
      state.userId === userId
        ? { notes: state.notes.filter((n) => n.noteId !== noteId) }
        : state
    ),
  addCanvas: (userId, fav) =>
    set((state) =>
      state.userId === userId
        ? {
            canvases: [
              fav,
              ...state.canvases.filter((c) => c.canvasId !== fav.canvasId),
            ],
          }
        : state
    ),
  removeCanvas: (userId, canvasId) =>
    set((state) =>
      state.userId === userId
        ? { canvases: state.canvases.filter((c) => c.canvasId !== canvasId) }
        : state
    ),
  reset: () =>
    set({
      userId: null,
      listsUserId: null,
      status: {},
      notes: [],
      canvases: [],
      fetchedAt: 0,
    }),
}));

export function resetFavoritesCache() {
  useFavoritesCacheStore.setState({
    userId: null,
    listsUserId: null,
    status: {},
    notes: [],
    canvases: [],
    fetchedAt: 0,
  });
}