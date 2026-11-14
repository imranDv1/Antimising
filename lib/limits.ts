import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";

export type PlanLimits = {
  /** Active Pro subscription (subscription row with endDate in the future, or no endDate). */
  isPro: boolean;
  /** Max characters per note body. */
  maxChars: number;
  /** Max owned notes, or null for unlimited. */
  noteLimit: number | null;
  /** Max images per note. */
  imagesPerNote: number;
  /** Max saved passwords, or null for unlimited. */
  passwordLimit: number | null;
  /** Max canvas boards, or null for unlimited. */
  canvasLimit: number | null;
};

export const FREE_PLAN: PlanLimits = {
  isPro: false,
  maxChars: 10000,
  noteLimit: 10,
  imagesPerNote: 3,
  passwordLimit: 10,
  canvasLimit: 3,
};

export const PRO_PLAN: PlanLimits = {
  isPro: true,
  maxChars: 50000,
  noteLimit: null,
  imagesPerNote: 10,
  passwordLimit: null,
  canvasLimit: null,
};

/**
 * Single server-side source of truth for plan limits.
 * Authorization/limit checks must call this directly and never rely on
 * /api/getSubs (that endpoint is display-only).
 */
export async function getPlanLimits(
  userId: string | null | undefined
): Promise<PlanLimits> {
  if (!userId) return FREE_PLAN;

  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const isActive =
    !!sub &&
    sub.isActive &&
    (!sub.endDate || sub.endDate.getTime() > Date.now());

  return isActive ? PRO_PLAN : FREE_PLAN;
}

/** Returned when a request exceeds a plan limit. */
export class PlanLimitError extends Error {}

function isPostgresLockError(): boolean {
  // The project runs on PostgreSQL (Neon), which supports advisory locks.
  return true;
}

/**
 * Race-safe critical section for count-then-create checks.
 * Serializes concurrent requests on the same user + resource with a
 * PostgreSQL advisory transaction lock, so two parallel requests cannot
 * both pass a free-tier count check.
 */
export async function withUserScopeLock<T>(
  userId: string,
  scope: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    if (isPostgresLockError()) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${scope}), hashtext(${userId}))`;
    }
    return fn(tx);
  });
}

// Rate limiting lives in lib/rate-limit.ts and is backed by PostgreSQL, so it
// is shared across serverless instances instead of being per-process.