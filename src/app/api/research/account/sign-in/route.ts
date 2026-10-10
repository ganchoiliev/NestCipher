import type { NextRequest } from "next/server";
import { z } from "zod";
import { CloudRequestBodyError, privateResponse, readBoundedCloudJson } from "@/lib/research-cloud-http";
import { prepareCloudRoute } from "@/lib/research-cloud-route";
import { researchSignInFailure, RESEARCH_SIGN_IN_COOLDOWN_SECONDS } from "@/lib/research-auth-feedback";
import { logSignInFailure } from "@/lib/research-auth-diagnostics";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const schema = z.object({ email: z.email().max(254) }).strict();

export async function POST(request: NextRequest) {
  const context = await prepareCloudRoute(request, "research-sign-in", true);
  if ("response" in context) return context.response;
  try {
    const parsed = schema.safeParse(await readBoundedCloudJson(request, 1024));
    if (!parsed.success) return context.apply(privateResponse({ error: "Enter a valid email address." }, 400));
    const { error } = await context.client.auth.signInWithOtp({
      email: parsed.data.email,
      options: { emailRedirectTo: `${context.config.appOrigin}/auth/callback`, shouldCreateUser: true },
    });
    if (error) {
      logSignInFailure(error, "auth-result");
      const { status, ...body } = researchSignInFailure(error);
      return context.apply(privateResponse(body, status));
    }
    return context.apply(privateResponse({ sent: true, retryAfterSeconds: RESEARCH_SIGN_IN_COOLDOWN_SECONDS }));
  } catch (error) {
    if (error instanceof CloudRequestBodyError) return context.apply(privateResponse({ error: error.message }, error.status));
    logSignInFailure(error, "exception");
    const { status, ...body } = researchSignInFailure(null);
    return context.apply(privateResponse(body, status));
  }
}
