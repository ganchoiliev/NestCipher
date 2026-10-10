import { describe, expect, it } from "vitest";
import {
  parseResearchAccountReturnStatus, researchAccountReturnNotice, researchSignInCooldownSeconds, researchSignInFailure,
} from "../research-auth-feedback";

describe("auth return hints", () => {
  it("accepts only the two exact single callback hints", () => {
    expect(parseResearchAccountReturnStatus("connected")).toBe("connected");
    expect(parseResearchAccountReturnStatus("error")).toBe("error");
    for (const value of [undefined, null, "signed-in", "connected ", ["connected"], ["error", "connected"], { status: "connected" }]) {
      expect(parseResearchAccountReturnStatus(value)).toBeUndefined();
    }
  });
  it("asks for a verified account check instead of treating a query as identity", () => {
    expect(researchAccountReturnNotice("connected")).toContain("Check account");
    expect(researchAccountReturnNotice("connected")).not.toContain("Signed in");
    expect(researchAccountReturnNotice("connected")).toContain("does not unlock or upload");
  });
  it("explains expired and wrong-browser links without requesting a vault reset", () => {
    expect(researchAccountReturnNotice("error")).toContain("expired");
    expect(researchAccountReturnNotice("error")).toContain("different browser");
    expect(researchAccountReturnNotice("error")).toContain("latest email");
  });
});

describe("safe sign-in failures", () => {
  it("describes restricted default email delivery without reflecting an address", () => {
    const providerError = { code: "email_address_not_authorized", status: 400, message: "PRIVATE_ADDRESS@example.test provider details" };
    const failure = researchSignInFailure(providerError);
    expect(failure).toMatchObject({ status: 503, code: "email-delivery-limited" });
    expect(failure.error).toContain("general use");
    expect(JSON.stringify(failure)).not.toContain("PRIVATE_ADDRESS");
  });
  it("handles disabled email delivery as service availability", () => {
    expect(researchSignInFailure({ code: "email_provider_disabled", status: 400 })).toMatchObject({ status: 503, code: "email-delivery-unavailable" });
  });
  it("recognizes documented send limits even with an unexpected provider status", () => {
    for (const code of ["over_email_send_rate_limit", "over_request_rate_limit"]) {
      expect(researchSignInFailure({ code, status: 400 })).toMatchObject({ status: 429, code: "sign-in-rate-limited", retryAfterSeconds: 60 });
    }
    expect(researchSignInFailure({ status: 429 })).toMatchObject({ status: 429, retryAfterSeconds: 60 });
  });
  it("does not disclose account existence from other errors", () => {
    const outcomes = ["email_exists", "user_not_found", "invalid_credentials", "unrecognized_provider_failure"]
      .map((code) => researchSignInFailure({ code, status: 400 }));
    for (const outcome of outcomes) expect(outcome).toEqual(researchSignInFailure(null));
  });
});

describe("local resend timer", () => {
  it("rounds remaining milliseconds up and ends at the actual deadline", () => {
    expect(researchSignInCooldownSeconds(61_000, 1_000)).toBe(60);
    expect(researchSignInCooldownSeconds(61_000, 60_001)).toBe(1);
    expect(researchSignInCooldownSeconds(61_000, 61_000)).toBe(0);
    expect(researchSignInCooldownSeconds(61_000, 62_000)).toBe(0);
  });
});
