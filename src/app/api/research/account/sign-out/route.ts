import type { NextRequest } from "next/server";
import { z } from "zod";
import { CloudRequestBodyError, privateResponse, readBoundedCloudJson } from "@/lib/research-cloud-http";
import { prepareCloudRoute, requireCloudUser } from "@/lib/research-cloud-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const context = await prepareCloudRoute(request, "research-sign-out", true);
  if ("response" in context) return context.response;
  try {
    const auth = await requireCloudUser(context);
    if ("response" in auth) return auth.response;
    const parsed = z.object({ expectedUserId: z.uuid() }).strict().safeParse(await readBoundedCloudJson(request, 128));
    if (!parsed.success) {
      return context.apply(privateResponse({ error: "Invalid sign-out request." }, 400));
    }
    if (parsed.data.expectedUserId !== auth.user.id) {
      return context.apply(privateResponse({ error: "Your signed-in account changed. Check your account before continuing.", code: "account-changed" }, 409));
    }
    const { error } = await context.client.auth.signOut({ scope: "local" });
    if (error) return context.apply(privateResponse({ error: "Sign-out could not be completed. Please try again." }, 502));
    return context.apply(privateResponse({ signedOut: true }));
  } catch (error) {
    if (error instanceof CloudRequestBodyError) return context.apply(privateResponse({ error: error.message }, error.status));
    return context.apply(privateResponse({ error: "Sign-out could not be completed. Please try again." }, 502));
  }
}
