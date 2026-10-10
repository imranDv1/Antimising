// context/notesPrefsStore.ts
import { create } from "zustand";
import { useEffect } from "react";

const STORAGE_KEY = "favoritesOnTop";
let hydrated = false;

interface NotesPrefsState {
  favoritesOnTop: boolean;
  setFavoritesOnTop: (value: boolean) => void;
}

export const useNotesPrefsStore = create<NotesPrefsState>((set) => ({
  favoritesOnTop: true,
  setFavoritesOnTop: (value) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Ignore storage errors (private mode, quota, etc.)
    }
    set({ favoritesOnTop: value });
  },
}));

// Load the persisted value once and keep the store in sync with other tabs,
// so a toggle in Settings applies instantly wherever the notes are shown.
function hydrateFavoritesOnTop() {
  if (typeof window === "undefined" || hydrated) return;
  hydrated = true;
  try {
    useNotesPrefsStore.setState({
      favoritesOnTop: window.localStorage.getItem(STORAGE_KEY) !== "false",
    });
  } catch {
    // Ignore storage errors
  }
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      useNotesPrefsStore.setState({
        favoritesOnTop: event.newValue !== "false",
      });
    }
  });
}

export function useFavoritesOnTop(): [boolean, (value: boolean) => void] {
  useEffect(() => {
    hydrateFavoritesOnTop();
  }, []);

  const favoritesOnTop = useNotesPrefsStore((s) => s.favoritesOnTop);
  const setFavoritesOnTop = useNotesPrefsStore((s) => s.setFavoritesOnTop);
  return [favoritesOnTop, setFavoritesOnTop];
}