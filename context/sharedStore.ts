// store/sharedStore.ts
import { create } from "zustand";

interface SharedStore {
  refreshSharedSignal: number; // رقم عشوائي للتغيير
  triggerSharedRefresh: () => void; // تحديث عدد الملاحظات المشتركة
}

export const useSharedStore = create<SharedStore>((set) => ({
  refreshSharedSignal: 0,
  triggerSharedRefresh: () =>
    set((state) => ({ refreshSharedSignal: state.refreshSharedSignal + 1 })),
}));