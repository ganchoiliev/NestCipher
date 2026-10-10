export interface ResearchCloudConfig {
  supabaseUrl: string;
  publishableKey: string;
  appOrigin: string;
  secureCookies: boolean;
}

/** Server configuration only: no credential is exposed by the account status route. */
export function readResearchCloudConfig(
  environment: Record<string, string | undefined> = process.env,
): ResearchCloudConfig | null {
  const { SUPABASE_URL: rawUrl, SUPABASE_PUBLISHABLE_KEY: key, NESTCIPHER_APP_URL: rawOrigin } = environment;
  if (!rawUrl || !key || !rawOrigin || key.length > 2048
    || !/^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(key)) return null;
  try {
    const project = new URL(rawUrl);
    const app = new URL(rawOrigin);
    const originOnly = (url: URL) => !url.username && !url.password
      && url.pathname === "/" && !url.search && !url.hash;
    if (!originOnly(project) || project.protocol !== "https:" || !originOnly(app)) return null;
    const localhost = ["localhost", "127.0.0.1", "[::1]"].includes(app.hostname);
    const localDevelopment = environment.NODE_ENV === "development" && localhost && app.protocol === "http:";
    const localPreview = environment.NESTCIPHER_ALLOW_LOCAL_CLOUD_PREVIEW === "true"
      && ["localhost", "127.0.0.1"].includes(app.hostname) && app.protocol === "http:";
    if (app.protocol !== "https:" && !localDevelopment && !localPreview) return null;
    return {
      supabaseUrl: project.origin,
      publishableKey: key,
      appOrigin: app.origin,
      secureCookies: app.protocol === "https:",
    };
  } catch { return null; }
}
