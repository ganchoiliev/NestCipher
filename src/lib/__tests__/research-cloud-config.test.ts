import { describe, expect, it } from "vitest";
import { readResearchCloudConfig } from "../research-cloud-config";

const environment = {
  NODE_ENV: "production", SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnopqrstuvwx",
  NESTCIPHER_APP_URL: "https://nestcipher.com",
};

describe("optional cloud configuration", () => {
  it("returns no configuration when any setting is absent", () => {
    for (const key of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "NESTCIPHER_APP_URL"]) {
      expect(readResearchCloudConfig({ ...environment, [key]: undefined })).toBeNull();
    }
  });
  it("accepts fixed HTTPS origins and a publishable key", () => {
    expect(readResearchCloudConfig(environment)).toEqual({
      supabaseUrl: "https://example.supabase.co", publishableKey: environment.SUPABASE_PUBLISHABLE_KEY,
      appOrigin: "https://nestcipher.com", secureCookies: true,
    });
  });
  it("rejects secret keys and legacy ambiguous keys", () => {
    for (const key of ["sb_secret_abcdefghijklmnopqrstuvwx", "eyJhbGciOiJIUzI1NiJ9.unknown", " ", "sb_publishable_x"]) {
      expect(readResearchCloudConfig({ ...environment, SUPABASE_PUBLISHABLE_KEY: key })).toBeNull();
    }
  });
  it("rejects origin paths, credentials, query strings and fragments", () => {
    for (const url of ["https://nestcipher.com/workbench", "https://user:pass@nestcipher.com", "https://nestcipher.com?next=x", "https://nestcipher.com#x", "not a URL"]) {
      expect(readResearchCloudConfig({ ...environment, NESTCIPHER_APP_URL: url })).toBeNull();
    }
  });
  it("rejects insecure Supabase endpoints", () => {
    expect(readResearchCloudConfig({ ...environment, SUPABASE_URL: "http://example.supabase.co" })).toBeNull();
  });
  it("allows local HTTP in development with an exact origin", () => {
    expect(readResearchCloudConfig({ ...environment, NODE_ENV: "development", NESTCIPHER_APP_URL: "http://127.0.0.1:3001" }))
      .toMatchObject({ appOrigin: "http://127.0.0.1:3001", secureCookies: false });
    expect(readResearchCloudConfig({ ...environment, NODE_ENV: "development", NESTCIPHER_APP_URL: "http://example.com" })).toBeNull();
  });
  it("rejects local production HTTP without the explicit preview flag", () => {
    expect(readResearchCloudConfig({ ...environment, NESTCIPHER_APP_URL: "http://127.0.0.1:3001" })).toBeNull();
  });
  it("preview exception only accepts localhost or 127.0.0.1", () => {
    for (const hostname of ["localhost", "127.0.0.1"]) {
      expect(readResearchCloudConfig({ ...environment, NESTCIPHER_ALLOW_LOCAL_CLOUD_PREVIEW: "true", NESTCIPHER_APP_URL: `http://${hostname}:3100` })).not.toBeNull();
    }
    for (const hostname of ["127.0.0.2", "localhost.evil.test", "example.com", "[::1]"]) {
      expect(readResearchCloudConfig({ ...environment, NESTCIPHER_ALLOW_LOCAL_CLOUD_PREVIEW: "true", NESTCIPHER_APP_URL: `http://${hostname}:3100` })).toBeNull();
    }
  });
});
