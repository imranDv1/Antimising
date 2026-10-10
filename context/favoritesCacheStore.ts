// context/favoritesCacheStore.ts
import { create } from "zustand";

interface FavoritesCacheState {
  userId: string | null;
  status: Record<string, boolean>;
  setStatus: (userId: string, status: Record<string, boolean>) => void;
  toggle: (noteId: string, value: boolean) => void;
  reset: () => void;
}

// Cache favorite flags per user so the "favorites on top" ordering is applied
// instantly on mount instead of waiting for a network round-trip.
export const useFavoritesCacheStore = create<FavoritesCacheState>((set) => ({
  userId: null,
  status: {},
  setStatus: (userId, status) => set({ userId, status }),
  toggle: (noteId, value) =>
    set((s) => ({ status: { ...s.status, [noteId]: value } })),
  reset: () => set({ userId: null, status: {} }),
}));