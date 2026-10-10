import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { inspectCloudLaunchConfiguration } from "../../../scripts/check-cloud-launch.mjs";

const environment = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrstuvwx",
  NESTCIPHER_APP_URL: "https://nestcipher.com",
  KV_REST_API_URL: "https://example.upstash.io",
  KV_REST_API_TOKEN: "PRIVATE_LIMITER_SENTINEL",
};

describe("hosted cloud configuration preflight", () => {
  it("checks configuration without claiming provider health", () => {
    const result = inspectCloudLaunchConfiguration(environment);
    expect(result.configurationReady).toBe(true);
    expect(result).not.toHaveProperty("smtpReady");
    expect(result).not.toHaveProperty("databaseHealthy");
  });
  it("lists missing names and never returns setting values", () => {
    const result = inspectCloudLaunchConfiguration({ ...environment, KV_REST_API_TOKEN: undefined });
    expect(result.missing).toEqual(["KV_REST_API_TOKEN"]);
    expect(result.configurationReady).toBe(false);
    const text = JSON.stringify(inspectCloudLaunchConfiguration(environment));
    for (const value of Object.values(environment)) expect(text).not.toContain(value);
  });
  it("rejects a service-role/secret credential even when all names exist", () => {
    expect(inspectCloudLaunchConfiguration({ ...environment, SUPABASE_PUBLISHABLE_KEY: "sb_secret_PRIVATE_KEY_SENTINEL" }).configurationReady).toBe(false);
  });
  it("requires an exact hosted HTTPS origin", () => {
    for (const appUrl of ["http://nestcipher.com", "https://nestcipher.com/path", "https://user:password@nestcipher.com", "https://nestcipher.com?query=secret", "https://nestcipher.com#fragment"]) {
      expect(inspectCloudLaunchConfiguration({ ...environment, NESTCIPHER_APP_URL: appUrl }).configurationReady).toBe(false);
    }
  });
  it("rejects local origins for hosted launch even with HTTPS", () => {
    for (const appUrl of ["http://127.0.0.1:3001", "https://localhost", "https://127.0.0.2", "https://[::1]"]) {
      expect(inspectCloudLaunchConfiguration({ ...environment, NESTCIPHER_APP_URL: appUrl }).configurationReady).toBe(false);
    }
  });
  it("requires the local preview exception to be absent", () => {
    for (const flag of ["true", "false", ""]) {
      expect(inspectCloudLaunchConfiguration({ ...environment, NESTCIPHER_ALLOW_LOCAL_CLOUD_PREVIEW: flag }).configurationReady).toBe(false);
    }
  });
  it("requires a credential-free HTTPS origin for the durable limiter", () => {
    for (const limiterUrl of [
      "not a URL", "http://example.upstash.io", "https://user:PRIVATE_PASSWORD@example.upstash.io",
      "https://example.upstash.io/path", "https://example.upstash.io?token=PRIVATE_QUERY", "https://example.upstash.io#PRIVATE_FRAGMENT",
    ]) {
      const result = inspectCloudLaunchConfiguration({ ...environment, KV_REST_API_URL: limiterUrl });
      expect(result.configurationReady).toBe(false);
      expect(result.checks.find((check) => check.name === "Durable limiter settings")?.ready).toBe(false);
      expect(JSON.stringify(result)).not.toContain(limiterUrl);
      expect(JSON.stringify(result)).not.toContain("PRIVATE_");
    }
  });
  it("handles an empty environment without accessing local configuration files", () => {
    const result = inspectCloudLaunchConfiguration({});
    expect(result.configurationReady).toBe(false);
    expect(result.missing).toHaveLength(5);
  });
});

describe("cloud launch CLI build gate", () => {
  const script = fileURLToPath(new URL("../../../scripts/check-cloud-launch.mjs", import.meta.url));
  const run = (args: string[], supplied: Record<string, string> = {}) => spawnSync(process.execPath, [script, ...args], {
    env: { ...supplied, NODE_ENV: "test" }, encoding: "utf8", timeout: 5_000,
  });

  it("fails a production build gate when required configuration is missing", () => {
    const result = run(["--if-production"], { VERCEL_ENV: "production" });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Missing setting names:");
    expect(result.stdout).toContain("KV_REST_API_TOKEN");
    expect(result.stdout).not.toContain("skipped");
  });

  it("runs all existing checks for production without printing setting values", () => {
    const result = run(["--if-production"], { ...environment, VERCEL_ENV: "production" });
    expect(result.status).toBe(0);
    expect(result.stdout.match(/^PASS /gm)).toHaveLength(6);
    expect(result.stdout).toContain("Configuration only.");
    for (const value of Object.values(environment)) expect(result.stdout + result.stderr).not.toContain(value);
  });

  it("refuses insecure limiter configuration and the local preview exception in production", () => {
    const result = run(["--if-production"], {
      ...environment, VERCEL_ENV: "production", KV_REST_API_URL: "http://example.upstash.io",
      NESTCIPHER_ALLOW_LOCAL_CLOUD_PREVIEW: "true",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("CHECK Durable limiter settings:");
    expect(result.stdout).toContain("CHECK Preview exception omitted:");
    expect(result.stdout).not.toContain("http://example.upstash.io");
  });

  it.each([undefined, "preview", "development"])("skips the optional build gate outside production (%s)", (target) => {
    const result = run(["--if-production"], target === undefined ? {} : { VERCEL_ENV: target });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("skipped outside Vercel Production");
    expect(result.stdout).not.toContain("PASS ");
    expect(result.stdout).not.toContain("Missing setting names:");
  });

  it.each([undefined, "preview"])("keeps the manual check strict outside production (%s)", (target) => {
    const result = run([], target === undefined ? {} : { VERCEL_ENV: target });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Missing setting names:");
    expect(result.stdout).not.toContain("skipped");
  });

  it("rejects unsupported options without echoing their values", () => {
    const result = run(["PRIVATE_ARGUMENT_SENTINEL"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Supported option:");
    expect(result.stderr).not.toContain("PRIVATE_ARGUMENT_SENTINEL");
  });
});
