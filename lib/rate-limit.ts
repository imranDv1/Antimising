import { prisma } from "@/lib/db";

/**
 * Rate limiting that actually holds in production.
 *
 * The old implementation lived in a module-level `Map`, which is only correct
 * for a single long-lived process. On Vercel (or any multi-instance / scale-to-
 * zero host) each instance kept its own counters, so the real budget was
 * `max × instances` and every cold start handed the caller a fresh allowance.
 *
 * This stores a fixed window per key in PostgreSQL and increments it with one
 * atomic upsert, so the budget is global across instances.
 *
 * Fails open: if the database is unreachable the request is allowed and the
 * error is logged. A rate limiter outage must not become an app outage.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<{ allowed: boolean }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, now() + make_interval(secs => CAST(${windowMs} AS double precision) / 1000))
      ON CONFLICT ("key") DO UPDATE
        SET "count" = CASE
              WHEN "RateLimit"."resetAt" <= now() THEN 1
              ELSE "RateLimit"."count" + 1
            END,
            "resetAt" = CASE
              WHEN "RateLimit"."resetAt" <= now()
                THEN now() + make_interval(secs => CAST(${windowMs} AS double precision) / 1000)
              ELSE "RateLimit"."resetAt"
            END
      RETURNING ("count" <= ${max}) AS allowed
    `;

    // Opportunistic cleanup so expired windows don't accumulate forever.
    if (Math.random() < 0.01) {
      void prisma.rateLimit
        .deleteMany({
          where: { resetAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        })
        .catch((error) => console.error("Rate limit cleanup failed:", error));
    }

    return rows[0]?.allowed ?? true;
  } catch (error) {
    console.error("Rate limiter unavailable, allowing request:", error);
    return true;
  }
}
