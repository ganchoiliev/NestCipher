import "server-only";

const authCodes = new Set([
  "bad_jwt", "captcha_failed", "email_address_invalid", "email_address_not_authorized",
  "email_provider_disabled", "hook_payload_invalid_content_type", "hook_payload_over_size_limit",
  "hook_timeout", "hook_timeout_after_retry", "no_authorization", "otp_disabled",
  "over_email_send_rate_limit", "over_request_rate_limit", "request_timeout",
  "signup_disabled", "unexpected_failure", "validation_failed",
]);
const networkCodes = new Set([
  "ECONNREFUSED", "ECONNRESET", "EAI_AGAIN", "ENOTFOUND", "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET", "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
]);

type DiagnosticCategory = "auth-api" | "auth-retryable" | "auth-client" | "auth-result" | "network" | "unexpected";
export type SignInDiagnosticSource = "auth-result" | "exception";
export type SignInDiagnostic = { category: DiagnosticCategory; status: number | null; code: string | null };

/** Read only own data properties: never invoke an error's getters or serialization. */
function ownValue(reason: unknown, property: string): unknown {
  if (reason === null || typeof reason !== "object") return undefined;
  try { return Object.getOwnPropertyDescriptor(reason, property)?.value; }
  catch { return undefined; }
}

/** Every emitted value is a fixed token, a bounded number, or null. */
export function sanitizeSignInDiagnostic(reason: unknown, source: SignInDiagnosticSource): SignInDiagnostic {
  const rawStatus = ownValue(reason, "status");
  const status = typeof rawStatus === "number" && Number.isInteger(rawStatus)
    && (rawStatus === 0 || (rawStatus >= 100 && rawStatus <= 599)) ? rawStatus : null;
  const rawCode = ownValue(reason, "code");
  const authCode = typeof rawCode === "string" && authCodes.has(rawCode) ? rawCode : null;
  const possibleNetworkCodes = [rawCode, ownValue(ownValue(reason, "cause"), "code"),
    ownValue(ownValue(reason, "originalError"), "code")];
  const networkCode = possibleNetworkCodes.find((code): code is string => typeof code === "string" && networkCodes.has(code)) ?? null;
  let category: DiagnosticCategory = source === "auth-result" ? "auth-result" : "unexpected";
  if (ownValue(reason, "__isAuthError") === true) {
    // Exact SDK identifiers select fixed labels; untrusted names are never emitted.
    const name = ownValue(reason, "name");
    category = name === "AuthApiError" ? "auth-api"
      : name === "AuthRetryableFetchError" ? "auth-retryable" : "auth-client";
  } else if (networkCode) category = "network";
  return { category, status, code: authCode ?? networkCode };
}

export function logSignInFailure(reason: unknown, source: SignInDiagnosticSource): void {
  console.warn("[research-auth] sign-in failed", JSON.stringify(sanitizeSignInDiagnostic(reason, source)));
}
