import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { ipAddress } from "@vercel/functions";
import type { NextRequest } from "next/server";

/**
 * Durable, shared rate limits and the global daily LLM budget.
 *
 * - Counters live in Upstash Redis (Vercel Marketplace, env prefix KV_*),
 *   so they survive cold starts and apply across every function instance —
 *   the in-memory Map this replaces did neither.
 * - The client IP comes from `ipAddress()` (@vercel/functions), the
 *   platform-trusted source. Raw `x-forwarded-for` is never parsed.
 * - Fail closed: if Redis is unreachable or unconfigured in production,
 *   limited routes refuse (503) rather than run unlimited. The only
 *   exception is local development without Redis env, which allows and
 *   warns, so tools remain testable offline.
 */

export type LimitDecision =
  | { ok: true }
  | { ok: false; status: number; error: string };

const ROUTE_LIMITS = {
  "analyze-email": { requests: 5, window: "1 h", friendly: "5 analyses per hour" },
  "scan-headers": { requests: 30, window: "1 h", friendly: "30 scans per hour" },
  subscribe: { requests: 3, window: "1 h", friendly: "3 attempts per hour" },
} as const;

export type LimitedRoute = keyof typeof ROUTE_LIMITS;

const isDev = process.env.NODE_ENV === "development";

let redisSingleton: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (redisSingleton !== undefined) return redisSingleton;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  redisSingleton = url && token ? new Redis({ url, token }) : null;
  return redisSingleton;
}

export interface LimiterLike {
  limit(key: string): Promise<{ success: boolean }>;
}

const limiters = new Map<LimitedRoute, LimiterLike | null>();

function getLimiter(route: LimitedRoute): LimiterLike | null {
  if (limiters.has(route)) return limiters.get(route) ?? null;
  const redis = getRedis();
  const limiter = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(
          ROUTE_LIMITS[route].requests,
          ROUTE_LIMITS[route].window
        ),
        prefix: `rl:${route}`,
      })
    : null;
  limiters.set(route, limiter);
  return limiter;
}

export function clientIp(request: NextRequest): string {
  // Platform-trusted. Never read x-forwarded-for by hand.
  return ipAddress(request) ?? "unresolved";
}

/** Pure decision logic, injectable for tests. */
export async function decideIpLimit(
  limiter: LimiterLike | null,
  ip: string,
  friendly: string,
  dev: boolean = isDev
): Promise<LimitDecision> {
  if (limiter === null) {
    if (dev) {
      console.warn("[limits] Redis not configured; allowing in development only.");
      return { ok: true };
    }
    return {
      ok: false,
      status: 503,
      error: "Rate limiting is unavailable right now. Please try again shortly.",
    };
  }
  try {
    const res = await limiter.limit(ip);
    if (res.success) return { ok: true };
    return {
      ok: false,
      status: 429,
      error: `Rate limit reached (${friendly}). Please try again later.`,
    };
  } catch {
    // Redis down: refuse rather than run unlimited.
    return {
      ok: false,
      status: 503,
      error: "Rate limiting is unavailable right now. Please try again shortly.",
    };
  }
}

export async function checkRouteLimit(
  route: LimitedRoute,
  request: NextRequest
): Promise<LimitDecision> {
  return decideIpLimit(
    getLimiter(route),
    `${route}:${clientIp(request)}`,
    ROUTE_LIMITS[route].friendly
  );
}

// ── Global daily LLM budget ──

export interface BudgetRedis {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

const BUDGET_KEY_TTL_SECONDS = 100_000; // > 24h, so a day's key cleans itself up

export function budgetKey(now: Date = new Date()): string {
  return `budget:llm:${now.toISOString().slice(0, 10)}`; // UTC day
}

/**
 * Spend one unit of the global daily LLM budget. The ceiling comes from
 * DAILY_LLM_BUDGET. A missing/invalid ceiling or an unreachable Redis
 * refuses (fail closed), except in local development without Redis.
 */
export async function spendLlmBudget(deps?: {
  redis?: BudgetRedis | null;
  ceiling?: number;
  now?: Date;
  dev?: boolean;
}): Promise<LimitDecision> {
  const dev = deps?.dev ?? isDev;
  const ceiling = deps?.ceiling ?? Number(process.env.DAILY_LLM_BUDGET);
  if (!Number.isFinite(ceiling) || ceiling <= 0) {
    return {
      ok: false,
      status: 503,
      error: "Analysis is temporarily unavailable.",
    };
  }

  const redis = deps?.redis !== undefined ? deps.redis : getRedis();
  if (redis === null) {
    if (dev) {
      console.warn("[limits] Redis not configured; budget not enforced in development.");
      return { ok: true };
    }
    return { ok: false, status: 503, error: "Analysis is temporarily unavailable." };
  }

  try {
    const key = budgetKey(deps?.now);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, BUDGET_KEY_TTL_SECONDS);
    }
    if (count > ceiling) {
      return {
        ok: false,
        status: 503,
        error:
          "Today's free analysis budget is spent. It resets at midnight UTC — please come back then.",
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, status: 503, error: "Analysis is temporarily unavailable." };
  }
}
