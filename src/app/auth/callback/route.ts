import { NextRequest, NextResponse } from "next/server";
import { checkRouteLimit } from "@/lib/limits";
import { readResearchCloudConfig } from "@/lib/research-cloud-config";
import { matchesCloudAuthority, noStore, privateResponse } from "@/lib/research-cloud-http";
import { createResearchCloudClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const config = readResearchCloudConfig();
  if (!config) return privateResponse({ error: "Account sign-in is not configured." }, 503);
  if (!matchesCloudAuthority(request, config)) return privateResponse({ error: "Invalid sign-in origin." }, 403);
  const returnUrl = `${config.appOrigin}/tools/research-workbench`;
  const failed = () => noStore(NextResponse.redirect(`${returnUrl}?account=error`, 303));
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const permitted = new Set(["code", "error", "error_code", "error_description"]);
  if (Array.from(params.keys()).some((key) => !permitted.has(key)) || params.getAll("code").length !== 1
    || params.has("error") || !code || code.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(code)) return failed();
  const limit = await checkRouteLimit("research-auth-callback", request);
  if (!limit.ok) return failed();
  const context = createResearchCloudClient(request, config);
  try {
    const { error } = await context.client.auth.exchangeCodeForSession(code);
    if (error) return context.apply(failed());
    return context.apply(noStore(NextResponse.redirect(`${returnUrl}?account=connected`, 303)));
  } catch { return context.apply(failed()); }
}
