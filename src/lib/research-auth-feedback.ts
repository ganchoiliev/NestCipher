export type ResearchAccountReturnStatus = "connected" | "error";
export const RESEARCH_SIGN_IN_COOLDOWN_SECONDS = 60;

/** A query value is only a navigation hint, never evidence of authentication. */
export function parseResearchAccountReturnStatus(value: unknown): ResearchAccountReturnStatus | undefined {
  return value === "connected" || value === "error" ? value : undefined;
}

export function researchAccountReturnNotice(status: ResearchAccountReturnStatus): string {
  return status === "connected"
    ? "Continue signing in. Choose Check account below to confirm your account. Signing in does not unlock or upload your vault."
    : "The sign-in link could not be completed. It may have expired or been opened in a different browser. Choose Check account below, then request a fresh link if needed. Use the latest email in the browser that requested it.";
}

type SignInFailure = { status: 429 | 502 | 503; code: string; error: string; retryAfterSeconds?: number };

/** Map only documented safe error codes. Provider messages and account existence stay private. */
export function researchSignInFailure(reason: { status?: number; code?: string } | null): SignInFailure {
  if (reason?.status === 429 || reason?.code === "over_email_send_rate_limit" || reason?.code === "over_request_rate_limit") {
    return {
      status: 429, code: "sign-in-rate-limited", retryAfterSeconds: RESEARCH_SIGN_IN_COOLDOWN_SECONDS,
      error: "Too many sign-in links were requested. Wait before requesting another link, or use the latest email in this browser.",
    };
  }
  if (reason?.code === "email_address_not_authorized") {
    return {
      status: 503, code: "email-delivery-limited",
      error: "Email sign-in is not ready for general use on this instance. You can continue with local research.",
    };
  }
  if (reason?.code === "email_provider_disabled") {
    return {
      status: 503, code: "email-delivery-unavailable",
      error: "Email sign-in is temporarily unavailable. You can continue with local research.",
    };
  }
  return {
    status: 502, code: "sign-in-unavailable",
    error: "Email sign-in is currently unavailable on this instance. You can continue with local research.",
  };
}

export function researchSignInCooldownSeconds(until: number, now: number): number {
  return Math.max(0, Math.ceil((until - now) / 1000));
}
