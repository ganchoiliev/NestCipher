import { NextResponse, type NextRequest } from "next/server";
import type { ResearchCloudConfig } from "./research-cloud-config";

export const CLOUD_BACKUP_MAX_WIRE_BYTES = 3 * 1024 * 1024;

export function privateResponse(body: unknown, status = 200): NextResponse {
  return noStore(NextResponse.json(body, { status }));
}

export function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  response.headers.set("Vary", "Cookie, Origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

/**
 * Host is compared against a fixed configured authority, never used as configuration.
 * NextURL normalizes 127.0.0.1 to localhost and deployments may use internal URLs.
 * Forwarded headers do not broaden this allowlist or determine callback destinations.
 */
export function matchesCloudAuthority(request: NextRequest, config: ResearchCloudConfig): boolean {
  const host = request.headers.get("host");
  if (host !== null) return host.toLowerCase() === new URL(config.appOrigin).host;
  // A synthetic Request can omit Host; no local aliases or forwarded values are accepted.
  return request.nextUrl.origin === config.appOrigin;
}

/** Mutations must also carry the exact browser Origin, independently of authority. */
export function allowsCloudRequest(request: NextRequest, config: ResearchCloudConfig, mutation = false): boolean {
  if (!matchesCloudAuthority(request, config)) return false;
  const origin = request.headers.get("origin");
  if (mutation && origin !== config.appOrigin) return false;
  if (origin !== null && origin !== config.appOrigin) return false;
  const site = request.headers.get("sec-fetch-site");
  return site === null || site === "same-origin" || site === "none";
}

export class CloudRequestBodyError extends Error {
  constructor(public readonly status: 400 | 413 | 415, message: string) { super(message); }
}

/** Count streamed bytes too: Content-Length alone is neither required nor trusted. */
export async function readBoundedCloudJson(request: NextRequest, maximum: number): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new CloudRequestBodyError(415, "Send a JSON request body.");
  }
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maximum)) {
    throw new CloudRequestBodyError(413, "The request is too large.");
  }
  if (!request.body) throw new CloudRequestBodyError(400, "Invalid JSON request body.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new CloudRequestBodyError(413, "The request is too large.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof CloudRequestBodyError) throw error;
    throw new CloudRequestBodyError(400, "Invalid JSON request body.");
  } finally { reader.releaseLock(); }
}
