import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db";

export type Limit = { limit: number; windowSeconds: number };

/**
 * Counts one request against `key` in a fixed window and says whether it is allowed.
 * One atomic upsert, so concurrent requests can't slip past the limit.
 */
export async function rateLimit(key: string, { limit, windowSeconds }: Limit) {
  const result = await getDb().execute(sql`
    insert into rate_limits (key, window_start, count)
    values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                   then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - make_interval(secs => ${windowSeconds})
                          then now() else rate_limits.window_start end
    returning count, greatest(1, ceil(extract(epoch from (window_start + make_interval(secs => ${windowSeconds}) - now()))))::int as retry_after
  `);
  const row = result.rows[0] as { count: number; retry_after: number };
  return { allowed: row.count <= limit, retryAfterSeconds: row.retry_after };
}

/** Client IP as set by the platform proxy (Vercel overwrites these headers). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}

export const tooManyRequests = (retryAfterSeconds: number) =>
  Response.json(
    { error: "too many requests, try again later" },
    { status: 429, headers: { "retry-after": String(retryAfterSeconds) } },
  );

export const PAIR_LIMIT: Limit = { limit: 10, windowSeconds: 15 * 60 };
export const EXTRACT_LIMIT: Limit = { limit: 20, windowSeconds: 60 * 60 };

/** AI assessments and practice sets cost AI credit: a handful per parent per hour is plenty. */
export const ASSESS_LIMIT: Limit = { limit: 10, windowSeconds: 60 * 60 };
