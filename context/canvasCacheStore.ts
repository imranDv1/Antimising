// context/canvasCacheStore.ts
import { create } from "zustand";
import type { CanvasDocument } from "@/components/canvas/excalidraw-editor";

type BoardPermission = "owner" | "read" | "write";

export interface CachedBoard {
  boardId: string;
  userId: string;
  title: string;
  document: CanvasDocument | null;
  permission: BoardPermission;
  updatedAt: string;
  fetchedAt: number;
}

export interface BoardMeta {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  permission: BoardPermission;
  ownerName?: string | null;
  ownerEmail?: string | null;
}

export interface BoardListSnapshot {
  userId: string;
  canvases: BoardMeta[];
  sharedCanvases: BoardMeta[];
  fetchedAt: number;
}

interface CanvasCacheState {
  cache: Record<string, CachedBoard>;
  list: BoardListSnapshot | null;
  set: (entry: CachedBoard) => void;
  patch: (boardId: string, partial: Partial<CachedBoard>) => void;
  remove: (boardId: string) => void;
  setList: (
    userId: string,
    canvases: BoardMeta[],
    sharedCanvases: BoardMeta[]
  ) => void;
  patchList: (
    updater: (list: BoardListSnapshot) => BoardListSnapshot
  ) => void;
  clear: () => void;
}

// Module-level cache so a recently opened board (its decrypted Excalidraw
// scene is the expensive part) is served instantly, and the boards list
// survives navigation without refetching. The server's `updatedAt` is used to
// only refetch when a board actually changed.
export const useCanvasCacheStore = create<CanvasCacheState>((set) => ({
  cache: {},
  list: null,
  set: (entry) =>
    set((state) => ({ cache: { ...state.cache, [entry.boardId]: entry } })),
  patch: (boardId, partial) =>
    set((state) => {
      const current = state.cache[boardId];
      if (!current) return state;
      return {
        cache: { ...state.cache, [boardId]: { ...current, ...partial } },
      };
    }),
  remove: (boardId) =>
    set((state) => {
      const next = { ...state.cache };
      delete next[boardId];
      return { cache: next };
    }),
  setList: (userId, canvases, sharedCanvases) =>
    set(() => ({
      list: { userId, canvases, sharedCanvases, fetchedAt: Date.now() },
    })),
  patchList: (updater) =>
    set((state) => (state.list ? { list: updater(state.list) } : state)),
  clear: () => set({ cache: {}, list: null }),
}));

export function resetCanvasCache() {
  useCanvasCacheStore.setState({ cache: {}, list: null });
}