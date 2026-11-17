import { create } from "zustand";

export type PlanInfo = {
  isPro: boolean;
  endsOn: string | null;
};

type PlanCacheState = {
  userId: string | null;
  plan: PlanInfo | null;
  fetchedAt: number;
  setPlan: (userId: string, plan: PlanInfo) => void;
  reset: () => void;
};

// Display-only cache. Authorization and limits are always enforced server-side
// through getPlanLimits(), never from this store.
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let pending: { userId: string; promise: Promise<PlanInfo | null> } | null = null;

export const usePlanCacheStore = create<PlanCacheState>((set) => ({
  userId: null,
  plan: null,
  fetchedAt: 0,
  setPlan: (userId, plan) => set({ userId, plan, fetchedAt: Date.now() }),
  reset: () => set({ userId: null, plan: null, fetchedAt: 0 }),
}));

async function requestPlan(userId: string): Promise<PlanInfo | null> {
  try {
    const res = await fetch("/api/getSubs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { isPro: !!data.isPro, endsOn: data.endsOn ?? null };
  } catch (err) {
    console.error("Failed to fetch subscription status", err);
    return null;
  }
}

export function invalidatePlanCache() {
  usePlanCacheStore.getState().reset();
}

export function getCachedPlan(userId: string): PlanInfo | null {
  const { userId: cachedUserId, plan, fetchedAt } = usePlanCacheStore.getState();
  if (cachedUserId !== userId || !plan) return null;
  if (Date.now() - fetchedAt > CACHE_TTL) return null;
  return plan;
}

/**
 * Returns the cached plan when it is still fresh, otherwise fetches it once.
 * Concurrent callers (e.g. the sidebar remounting while collapsed/expanded)
 * share the same in-flight request instead of hitting the API again.
 */
export function loadPlan(
  userId: string,
  options: { force?: boolean } = {}
): Promise<PlanInfo | null> {
  if (!options.force) {
    const cached = getCachedPlan(userId);
    if (cached) return Promise.resolve(cached);
  }

  if (pending?.userId === userId) return pending.promise;

  const promise = requestPlan(userId).then((plan) => {
    if (plan) usePlanCacheStore.getState().setPlan(userId, plan);
    if (pending?.promise === promise) pending = null;
    return plan;
  });

  pending = { userId, promise };
  return promise;
}
