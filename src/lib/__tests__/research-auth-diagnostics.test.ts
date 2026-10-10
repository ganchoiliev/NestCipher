import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { logSignInFailure, sanitizeSignInDiagnostic } from "../research-auth-diagnostics";

describe("private sign-in diagnostics", () => {
  it("logs only fixed tokens while discarding private error content and serialization", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const serialize = vi.fn(() => "PRIVATE_SERIALIZATION");
    const reason = {
      __isAuthError: true, name: "AuthApiError", status: 500, code: "unexpected_failure",
      message: "PRIVATE_PROVIDER_MESSAGE", email: "PRIVATE_EMAIL@example.test",
      requestBody: "PRIVATE_BODY", cookies: "PRIVATE_COOKIES", url: "https://PRIVATE_URL.test",
      credentials: "PRIVATE_KEY", constructor: { name: "PRIVATE_CONSTRUCTOR" }, toJSON: serialize,
    };
    try {
      logSignInFailure(reason, "auth-result");
      expect(warn).toHaveBeenCalledExactlyOnceWith("[research-auth] sign-in failed",
        '{"category":"auth-api","status":500,"code":"unexpected_failure"}');
      expect(JSON.stringify(warn.mock.calls)).not.toContain("PRIVATE_");
      expect(serialize).not.toHaveBeenCalled();
    } finally { warn.mockRestore(); }
  });

  it("distinguishes retryable no-response and upstream failures without logging SDK messages", () => {
    for (const status of [0, 500, 503]) {
      expect(sanitizeSignInDiagnostic({ __isAuthError: true, name: "AuthRetryableFetchError", status, message: "PRIVATE_MESSAGE" }, "auth-result"))
        .toEqual({ category: "auth-retryable", status, code: null });
    }
  });

  it("retains only exact allowlisted network codes from a bounded cause", () => {
    expect(sanitizeSignInDiagnostic(new Error("PRIVATE_MESSAGE", { cause: { code: "ENOTFOUND", hostname: "PRIVATE_HOST" } }), "exception"))
      .toEqual({ category: "network", status: null, code: "ENOTFOUND" });
    for (const code of ["ENOTFOUND PRIVATE_KEY", "PRIVATE_KEY", { toString: () => "ENOTFOUND" }]) {
      expect(sanitizeSignInDiagnostic({ cause: { code } }, "exception"))
        .toEqual({ category: "unexpected", status: null, code: null });
    }
  });

  it("rejects unsupported status values and never emits unknown names or codes", () => {
    for (const status of [-1, 99, 600, 401.5, Infinity, NaN, "401", null]) {
      expect(sanitizeSignInDiagnostic({ status, name: "PRIVATE_NAME", code: "PRIVATE_CODE" }, "auth-result"))
        .toEqual({ category: "auth-result", status: null, code: null });
    }
  });

  it("does not invoke getters or let unusual error objects break diagnostics", () => {
    const getter = vi.fn(() => { throw new Error("PRIVATE_GETTER"); });
    const reason = Object.defineProperties({}, Object.fromEntries(
      ["name", "status", "code", "cause", "__isAuthError", "message", "constructor"].map((property) => [property, { get: getter }]),
    ));
    expect(sanitizeSignInDiagnostic(reason, "exception")).toEqual({ category: "unexpected", status: null, code: null });
    expect(getter).not.toHaveBeenCalled();
    const proxy = new Proxy({}, { getOwnPropertyDescriptor: getter });
    expect(sanitizeSignInDiagnostic(proxy, "exception")).toEqual({ category: "unexpected", status: null, code: null });
  });
});
