/**
 * Honest CSP scoring for the headers scanner (finding 5 in
 * docs/THREAT-MODEL.md): a present-but-hollow policy no longer scores full
 * marks. 'unsafe-inline', 'unsafe-eval' and scheme-wide script sources cost
 * points; a policy with no script-src/default-src is near-worthless.
 *
 * Scoring is over the SCRIPT policy (script-src, falling back to
 * default-src), because script execution is what CSP is for. Modern
 * browsers ignore 'unsafe-inline' and host/scheme sources when a nonce or
 * 'strict-dynamic' is present, so those combinations are not penalised.
 */

export interface CspScore {
  score: number; // 0..20
  status: "pass" | "partial" | "fail";
  notes: string[];
}

function parseDirectives(value: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const part of value.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const name = tokens[0].toLowerCase();
    if (!map.has(name)) map.set(name, tokens.slice(1).map((t) => t.toLowerCase()));
  }
  return map;
}

export function scoreCsp(value: string | null): CspScore {
  if (!value || value.trim() === "") {
    return { score: 0, status: "fail", notes: ["No Content-Security-Policy header."] };
  }

  const directives = parseDirectives(value);
  const script = directives.get("script-src") ?? directives.get("default-src");
  const notes: string[] = [];

  if (script === undefined) {
    return {
      score: 4,
      status: "fail",
      notes: [
        "Neither script-src nor default-src is set, so the policy does not restrict script execution at all.",
      ],
    };
  }

  const hasNonce = script.some((s) => s.startsWith("'nonce-"));
  const hasStrictDynamic = script.includes("'strict-dynamic'");
  const modernKeyed = hasNonce || hasStrictDynamic;

  let score = 20;

  if (script.includes("'unsafe-inline'")) {
    if (modernKeyed) {
      notes.push(
        "'unsafe-inline' is present but neutralised by a nonce/'strict-dynamic' in modern browsers."
      );
    } else {
      score -= 8;
      notes.push("'unsafe-inline' allows any injected inline script to run.");
    }
  }

  if (script.includes("'unsafe-eval'")) {
    score -= 6;
    notes.push("'unsafe-eval' allows string-to-code execution (eval, new Function).");
  }

  const broadSources = ["*", "https:", "http:", "data:", "blob:"];
  const broad = script.filter((s) => broadSources.includes(s));
  if (broad.length > 0 && !hasStrictDynamic) {
    score -= 4;
    notes.push(
      `Scheme-wide script source${broad.length > 1 ? "s" : ""} (${broad.join(", ")}) permit scripts from effectively anywhere.`
    );
  }

  const defaultIsNone = (directives.get("default-src") ?? []).includes("'none'");
  if (!directives.has("object-src") && !defaultIsNone) {
    score -= 2;
    notes.push("object-src is not set; plugin content is unrestricted.");
  }
  if (!directives.has("base-uri")) {
    score -= 2;
    notes.push("base-uri is not set; injected <base> tags can redirect relative URLs.");
  }

  score = Math.max(0, score);
  const status: CspScore["status"] = score >= 16 ? "pass" : score >= 8 ? "partial" : "fail";
  return { score, status, notes };
}
