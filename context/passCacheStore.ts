// context/passCacheStore.ts
import { create } from "zustand";

// Module-level cache so the vault list survives client-side navigation
// without refetching the (decrypted) passwords every time. The list is only
// refetched when the refresh signal fires after mount or the cache aged out.
export type Pass = {
  id: string;
  title: string;
  username: string;
  password: string;
  description: string;
  category: string;
  createdAt: string;
};

interface PassCacheState {
  userId: string | null;
  pass: Pass[];
  fetchedAt: number;
  setPass: (userId: string, pass: Pass[]) => void;
  prepend: (pass: Pass) => void;
  update: (pass: Pass) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const usePassCacheStore = create<PassCacheState>((set) => ({
  userId: null,
  pass: [],
  fetchedAt: 0,
  setPass: (userId, pass) => set({ userId, pass, fetchedAt: Date.now() }),
  prepend: (pass) => set((s) => ({ pass: [pass, ...s.pass] })),
  update: (pass) =>
    set((s) => ({
      pass: s.pass.map((p) => (p.id === pass.id ? pass : p)),
    })),
  remove: (id) => set((s) => ({ pass: s.pass.filter((p) => p.id !== id) })),
  clear: () => set({ userId: null, pass: [], fetchedAt: 0 }),
}));

export function resetPassCache() {
  usePassCacheStore.setState({ userId: null, pass: [], fetchedAt: 0 });
}