import { describe, expect, it } from "vitest";
import {
  buildCsp,
  generateNonce,
  isResearchWorkbenchPath,
  WORKBENCH_REQUEST_HEADER,
} from "../csp";
import { scoreCsp } from "../csp-score";

describe("buildCsp", () => {
  const nonce = generateNonce();
  const prod = buildCsp(nonce, false);
  const dev = buildCsp(nonce, true);

  it("carries the nonce and strict-dynamic, and bans eval in production", () => {
    expect(prod).toContain(`'nonce-${nonce}'`);
    expect(prod).toContain("'strict-dynamic'");
    expect(prod).not.toContain("'unsafe-eval'");
  });

  it("allows eval only in development (React debugging)", () => {
    expect(dev).toContain("'unsafe-eval'");
  });

  it("locks down every directive the threat model requires", () => {
    for (const directive of [
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "connect-src 'self' https://plausible.io",
      "img-src 'self' data:",
      "upgrade-insecure-requests",
    ]) {
      expect(prod).toContain(directive);
    }
  });

  it("generates a fresh nonce per call", () => {
    expect(generateNonce()).not.toBe(generateNonce());
  });

  it("removes analytics connections from the workbench without relaxing other directives", () => {
    const workbench = buildCsp(nonce, false, { analytics: false });
    expect(workbench.split("; ")).toContain("connect-src 'self'");
    expect(workbench).not.toContain("plausible.io");
    const exceptConnections = (policy: string) => policy.split("; ")
      .filter((directive) => !directive.startsWith("connect-src "));
    expect(exceptConnections(workbench)).toEqual(exceptConnections(prod));
    expect(scoreCsp(workbench).score).toBe(20);
  });

  it.each([
    ["/tools/research-workbench", true],
    ["/tools/research-workbench/", true],
    ["/tools/research-workbench-other", false],
    ["/tools/email-analyzer", false],
    ["/tools", false],
  ])("uses an exact workbench route boundary for %s", (path, expected) => {
    expect(isResearchWorkbenchPath(path)).toBe(expected);
  });
});

describe("proxy serves the CSP on every page route", () => {
  const pageRoutes = [
    "/",
    "/tools",
    "/about",
    "/community",
    "/privacy",
    "/tools/email-analyzer",
    "/tools/headers-scanner",
    "/tools/owasp-llm-top-10",
    "/tools/prompt-injection-tester",
    "/tools/research-workbench",
  ];

  it.each(pageRoutes)("%s gets a nonce CSP and x-nonce", async (path) => {
    const { proxy } = await import("../../proxy");
    const { NextRequest } = await import("next/server");
    const request = new NextRequest(`https://nestcipher.com${path}`);
    const response = proxy(request);
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toBeTruthy();
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(csp).not.toContain("'unsafe-eval'"); // vitest runs with NODE_ENV=test
  });

  it.each([
    ["/tools/research-workbench", "0", "1", false],
    ["/tools/research-workbench/", "0", "1", false],
    ["/tools/email-analyzer", "1", "0", true],
    ["/tools/research-workbench-other", "1", "0", true],
  ])("overwrites an inbound boundary header on %s", async (path, inbound, expected, allowsAnalytics) => {
    const { proxy } = await import("../../proxy");
    const { NextRequest } = await import("next/server");
    const response = proxy(new NextRequest(`https://nestcipher.com${path}`, {
      headers: {
        [WORKBENCH_REQUEST_HEADER]: inbound,
        "x-nonce": "untrusted-inbound-nonce",
        "next-router-prefetch": "1",
        purpose: "prefetch",
      },
    }));
    expect(response.headers.get(`x-middleware-request-${WORKBENCH_REQUEST_HEADER}`)).toBe(expected);
    expect(response.headers.get("x-middleware-request-x-nonce")).not.toBe("untrusted-inbound-nonce");
    const csp = response.headers.get("Content-Security-Policy")!;
    expect(csp.includes("https://plausible.io")).toBe(allowsAnalytics);
    expect(csp).toContain("'strict-dynamic'");
  });

  it("does not exempt prefetches from overwriting the boundary header", async () => {
    const { config } = await import("../../proxy");
    expect(config.matcher[0]).not.toHaveProperty("missing");
  });
});

describe("static security headers from next.config", () => {
  it("sets HSTS with includeSubDomains (no preload yet) on every route", async () => {
    const config = (await import("../../../next.config")).default;
    const rules = await config.headers!();
    const all = rules.find((r) => r.source === "/(.*)");
    expect(all).toBeTruthy();
    const hsts = all!.headers.find((h) => h.key === "Strict-Transport-Security");
    expect(hsts?.value).toBe("max-age=31536000; includeSubDomains");
    expect(hsts?.value).not.toContain("preload");
    // The static unsafe-* CSP is gone from next.config; the proxy owns CSP.
    expect(all!.headers.find((h) => h.key === "Content-Security-Policy")).toBeUndefined();
    for (const key of [
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Cross-Origin-Opener-Policy",
      "Cross-Origin-Resource-Policy",
    ]) {
      expect(all!.headers.find((h) => h.key === key)).toBeTruthy();
    }
  });
});

describe("scoreCsp: honest grading", () => {
  it("fails NestCipher's own old policy", () => {
    const old =
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://plausible.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';";
    const r = scoreCsp(old);
    expect(r.score).toBeLessThanOrEqual(4); // -8 inline, -6 eval, -2 object-src, -2 base-uri
    expect(r.status).toBe("fail");
  });

  it("passes the new nonce + strict-dynamic policy at full marks", () => {
    const r = scoreCsp(buildCsp(generateNonce(), false));
    expect(r.score).toBe(20);
    expect(r.status).toBe("pass");
  });

  it("near-zeroes a policy with no script restrictions", () => {
    const r = scoreCsp("upgrade-insecure-requests");
    expect(r.score).toBeLessThanOrEqual(4);
    expect(r.status).toBe("fail");
  });

  it("penalises scheme-wide script sources without strict-dynamic", () => {
    const r = scoreCsp("script-src 'self' https:; object-src 'none'; base-uri 'none'");
    expect(r.score).toBe(16); // -4 for https:
  });

  it("does not penalise unsafe-inline neutralised by a nonce", () => {
    const r = scoreCsp(
      "script-src 'self' 'nonce-abc123' 'unsafe-inline'; object-src 'none'; base-uri 'none'"
    );
    expect(r.score).toBe(20);
  });

  it("fails a missing header", () => {
    expect(scoreCsp(null).score).toBe(0);
    expect(scoreCsp("").score).toBe(0);
  });
});
