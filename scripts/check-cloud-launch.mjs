import { pathToFileURL } from "node:url";

/**
 * Configuration check only. The caller supplies the deployment runtime environment.
 * No .env file is loaded, no provider is contacted and no setting value is returned.
 * @param {Record<string, string | undefined>} environment
 */
export function inspectCloudLaunchConfiguration(environment) {
  const required = ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "NESTCIPHER_APP_URL", "KV_REST_API_URL", "KV_REST_API_TOKEN"];
  const present = (name) => typeof environment[name] === "string" && environment[name].trim().length > 0;
  const missing = required.filter((name) => !present(name));
  const origin = (value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" && !parsed.username && !parsed.password
        && parsed.pathname === "/" && !parsed.search && !parsed.hash ? parsed : null;
    } catch { return null; }
  };
  const app = origin(environment.NESTCIPHER_APP_URL);
  const hostedOrigin = app !== null && app.hostname !== "localhost" && app.hostname !== "[::1]"
    && !/^127\./.test(app.hostname);
  const checks = [
    { name: "Required settings", variables: required, ready: missing.length === 0 },
    { name: "Supabase HTTPS origin", variables: ["SUPABASE_URL"], ready: origin(environment.SUPABASE_URL) !== null },
    { name: "Publishable credential", variables: ["SUPABASE_PUBLISHABLE_KEY"], ready: /^sb_publishable_[A-Za-z0-9_-]{16,}$/.test(environment.SUPABASE_PUBLISHABLE_KEY ?? "") && (environment.SUPABASE_PUBLISHABLE_KEY?.length ?? 0) <= 2048 },
    { name: "Hosted HTTPS app origin", variables: ["NESTCIPHER_APP_URL"], ready: hostedOrigin },
    { name: "Preview exception omitted", variables: ["NESTCIPHER_ALLOW_LOCAL_CLOUD_PREVIEW"], ready: environment.NESTCIPHER_ALLOW_LOCAL_CLOUD_PREVIEW === undefined },
    { name: "Durable limiter settings", variables: ["KV_REST_API_URL", "KV_REST_API_TOKEN"], ready: origin(environment.KV_REST_API_URL) !== null && present("KV_REST_API_TOKEN") },
  ];
  return { configurationReady: checks.every((check) => check.ready), missing, checks };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== "--if-production")) {
    console.error("Supported option: --if-production. Without it, configuration checks are always required.");
    process.exitCode = 1;
  } else if (args[0] === "--if-production" && process.env.VERCEL_ENV !== "production") {
    console.log("Cloud launch build gate skipped outside Vercel Production. The manual configuration check remains strict.");
    process.exitCode = 0;
  } else {
    const result = inspectCloudLaunchConfiguration(process.env);
    console.log("NestCipher encrypted cloud backup: hosted configuration check");
    for (const check of result.checks) console.log(`${check.ready ? "PASS" : "CHECK"} ${check.name}: ${check.variables.join(", ")}`);
    if (result.missing.length > 0) console.log(`Missing setting names: ${result.missing.join(", ")}`);
    console.log("Configuration only. Verify database permissions, limiter availability, callback URLs, email delivery and DNS separately.");
    process.exitCode = result.configurationReady ? 0 : 1;
  }
}
