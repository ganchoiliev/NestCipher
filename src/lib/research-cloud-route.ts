import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { checkRouteLimit, type LimitedRoute } from "./limits";
import { readResearchCloudConfig, type ResearchCloudConfig } from "./research-cloud-config";
import { allowsCloudRequest, privateResponse } from "./research-cloud-http";
import { createResearchCloudClient } from "./supabase/server";

export type CloudRouteContext = { config: ResearchCloudConfig } & ReturnType<typeof createResearchCloudClient>;

export async function prepareCloudRoute(request: NextRequest, route: LimitedRoute, mutation = false): Promise<
  { response: NextResponse } | CloudRouteContext
> {
  const config = readResearchCloudConfig();
  if (!config) return { response: privateResponse({ error: "Cloud backup is not configured." }, 503) };
  if (!allowsCloudRequest(request, config, mutation)) {
    return { response: privateResponse({ error: "This request must come from NestCipher." }, 403) };
  }
  const limit = await checkRouteLimit(route, request);
  if (!limit.ok) return { response: privateResponse({ error: limit.error }, limit.status) };
  return { config, ...createResearchCloudClient(request, config) };
}

export async function requireCloudUser(context: CloudRouteContext): Promise<{ response: NextResponse } | { user: User }> {
  // getUser validates with Auth and observes revoked sessions; getSession is not authorization.
  const { data, error } = await context.client.auth.getUser();
  if (error || !data.user) {
    return { response: context.apply(privateResponse({ error: "Sign in to use your cloud backup." }, 401)) };
  }
  return { user: data.user };
}
