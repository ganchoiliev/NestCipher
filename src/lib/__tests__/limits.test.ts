import { describe, expect, it } from "vitest";
import {
  budgetKey,
  decideIpLimit,
  spendLlmBudget,
  type BudgetRedis,
  type LimiterLike,
} from "../limits";

const allow: LimiterLike = { limit: async () => ({ success: true }) };
const deny: LimiterLike = { limit: async () => ({ success: false }) };
const broken: LimiterLike = {
  limit: async () => {
    throw new Error("redis down");
  },
};

describe("decideIpLimit", () => {
  it("allows under the limit", async () => {
    expect(await decideIpLimit(allow, "1.2.3.4", "5 per hour", false)).toEqual({
      ok: true,
    });
  });

  it("refuses over the limit with 429", async () => {
    const r = await decideIpLimit(deny, "1.2.3.4", "5 per hour", false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(429);
  });

  it("fails closed with 503 when Redis errors", async () => {
    const r = await decideIpLimit(broken, "1.2.3.4", "5 per hour", false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });

  it.each([false, true])("fails closed on the SDK's allowed timeout result with dev=%s", async (dev) => {
    const timedOut: LimiterLike = { limit: async () => ({ success: true, reason: "timeout" }) };
    expect(await decideIpLimit(timedOut, "1.2.3.4", "5 per hour", dev)).toEqual({
      ok: false,
      status: 503,
      error: "Rate limiting is unavailable right now. Please try again shortly.",
    });
  });

  it.each(["cacheBlock", "denyList"] as const)("keeps a %s SDK rejection blocked with 429", async (reason) => {
    const rejected: LimiterLike = { limit: async () => ({ success: false, reason }) };
    const result = await decideIpLimit(rejected, "1.2.3.4", "5 per hour", false);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(429);
  });

  it("fails closed with 503 when no limiter is configured in production", async () => {
    const r = await decideIpLimit(null, "1.2.3.4", "5 per hour", false);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });

  it("allows without a limiter only in development", async () => {
    expect(await decideIpLimit(null, "1.2.3.4", "5 per hour", true)).toEqual({
      ok: true,
    });
  });
});

function stubRedis(start = 0): BudgetRedis & {
  counts: Map<string, number>;
  expiries: Map<string, number>;
} {
  const counts = new Map<string, number>();
  const expiries = new Map<string, number>();
  return {
    counts,
    expiries,
    async incr(key) {
      const next = (counts.get(key) ?? start) + 1;
      counts.set(key, next);
      return next;
    },
    async expire(key, seconds) {
      expiries.set(key, seconds);
      return 1;
    },
  };
}

describe("spendLlmBudget", () => {
  const now = new Date("2026-10-09T12:00:00Z");

  it("spends within the ceiling and sets expiry on the first spend", async () => {
    const redis = stubRedis();
    const r = await spendLlmBudget({ redis, ceiling: 2, now, dev: false });
    expect(r).toEqual({ ok: true });
    expect(redis.expiries.get(budgetKey(now))).toBeGreaterThan(86_400);
  });

  it("refuses once the ceiling is crossed", async () => {
    const redis = stubRedis();
    await spendLlmBudget({ redis, ceiling: 2, now, dev: false });
    await spendLlmBudget({ redis, ceiling: 2, now, dev: false });
    const third = await spendLlmBudget({ redis, ceiling: 2, now, dev: false });
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.status).toBe(503);
  });

  it("fails closed on a missing or invalid ceiling", async () => {
    const redis = stubRedis();
    for (const ceiling of [NaN, 0, -5]) {
      const r = await spendLlmBudget({ redis, ceiling, now, dev: false });
      expect(r.ok).toBe(false);
    }
  });

  it("fails closed when Redis errors", async () => {
    const r = await spendLlmBudget({
      redis: {
        incr: async () => {
          throw new Error("down");
        },
        expire: async () => 1,
      },
      ceiling: 10,
      now,
      dev: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });

  it("fails closed without Redis in production, allows in development", async () => {
    const prod = await spendLlmBudget({ redis: null, ceiling: 10, now, dev: false });
    expect(prod.ok).toBe(false);
    const dev = await spendLlmBudget({ redis: null, ceiling: 10, now, dev: true });
    expect(dev.ok).toBe(true);
  });

  it("keys the budget by UTC day", () => {
    expect(budgetKey(new Date("2026-10-09T23:59:59Z"))).toBe("budget:llm:2026-10-09");
    expect(budgetKey(new Date("2026-10-10T00:00:01Z"))).toBe("budget:llm:2026-10-10");
  });
});
