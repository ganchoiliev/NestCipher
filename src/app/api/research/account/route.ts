import type { NextRequest } from "next/server";
import { readResearchCloudConfig } from "@/lib/research-cloud-config";
import { privateResponse } from "@/lib/research-cloud-http";
import { prepareCloudRoute } from "@/lib/research-cloud-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!readResearchCloudConfig()) return privateResponse({ configured: false, user: null });
  const context = await prepareCloudRoute(request, "research-account");
  if ("response" in context) return context.response;
  try {
    const { data, error } = await context.client.auth.getUser();
    if (error && (error.status ?? 0) >= 500) {
      return context.apply(privateResponse({ error: "Account status is temporarily unavailable." }, 502));
    }
    return context.apply(privateResponse({
      configured: true,
      user: !error && data.user ? { id: data.user.id, email: data.user.email ?? null } : null,
    }));
  } catch {
    return context.apply(privateResponse({ error: "Account status is temporarily unavailable." }, 502));
  }
}
