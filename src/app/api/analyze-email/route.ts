import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkBotId } from "botid/server";
import { checkRouteLimit, spendLlmBudget } from "@/lib/limits";
import type { EmailAnalysisResponse } from "@/types/email-analyzer";

// Layer order (docs/THREAT-MODEL.md A2/A3): WAF (edge) → schema → durable
// per-IP limit → bot check → global daily budget → provider. Each layer
// refuses on its own. Prompt hardening (structured outputs, delimited
// email, deterministic pre-pass) is the next deliverable.

// ── System Prompt ──

const SYSTEM_PROMPT = `You are an expert email security analyst specializing in phishing detection, social engineering, and email fraud. Analyze the provided email content and return a structured JSON assessment.

Evaluate the email across these 6 categories, scoring each 0-100:

1. Urgency & Pressure: Does the email create artificial urgency? Threats of account closure, deadlines, limited-time offers, fear tactics.
2. Sender Legitimacy: Does the sender appear legitimate? Check for domain spoofing, display name tricks, free email providers posing as companies, mismatched reply-to addresses.
3. Link & URL Safety: Are there suspicious links? Look for URL shorteners, misspelled domains, IP-based URLs, links that don't match the claimed sender, hidden redirects.
4. Language & Grammar: Does the email have unusual grammar, spelling errors, awkward phrasing, or inconsistent tone that suggests it was hastily written or machine-translated?
5. Impersonation Signals: Is the email trying to impersonate a known brand, authority figure, colleague, or institution? Look for brand name abuse, logo references, fake titles.
6. Request Analysis: What is the email asking the user to do? Requests for credentials, personal information, money transfers, downloading attachments, or clicking links are high-risk.

For each category provide:
- A score from 0 (no threat) to 100 (definite threat)
- A threat level: "safe" (0-15), "low" (16-35), "medium" (36-60), "high" (61-85), "critical" (86-100)
- 2-4 specific findings
- A brief explanation of why this matters

Also identify specific suspicious elements (links, sender details, attachments, language patterns, impersonation attempts).

Calculate an overall threat score (0-100) as a weighted average:
- Urgency & Pressure: 15%
- Sender Legitimacy: 25%
- Link & URL Safety: 25%
- Language & Grammar: 10%
- Impersonation Signals: 15%
- Request Analysis: 10%

Respond ONLY with valid JSON matching this exact structure (no markdown, no backticks, no explanation outside the JSON):
{
  "overallScore": <number 0-100>,
  "overallLevel": "<safe|low|medium|high|critical>",
  "verdict": "<one sentence summary>",
  "categories": [
    {
      "name": "<category name>",
      "score": <number 0-100>,
      "level": "<safe|low|medium|high|critical>",
      "findings": ["<finding 1>", "<finding 2>"],
      "explanation": "<why this matters>"
    }
  ],
  "suspiciousElements": [
    {
      "type": "<link|sender|attachment|language|impersonation|other>",
      "value": "<the suspicious element>",
      "reason": "<why it's suspicious>"
    }
  ],
  "recommendations": ["<action 1>", "<action 2>", "<action 3>"],
  "summary": "<2-3 sentence analysis summary>"
}

If the email appears completely legitimate, still return the full JSON structure with low scores and positive findings. Never refuse to analyze — even safe emails should get a full breakdown showing why they're safe.`;

// ── Input schema ──

const BodySchema = z.object({
  emailContent: z
    .string()
    .trim()
    .min(10, "Please paste a longer email — at least 10 characters are needed for analysis.")
    .max(15000, "Email content is too long. Please limit to 15,000 characters."),
});

// ── Route Handler ──

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) {
    return NextResponse.json(
      { error: "Email analysis is temporarily unavailable." },
      { status: 503 }
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "Please paste an email to analyze.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const content = parsed.data.emailContent;

  // Durable per-IP limit (Upstash), platform-trusted IP.
  const limit = await checkRouteLimit("analyze-email", request);
  if (!limit.ok) {
    return NextResponse.json({ error: limit.error }, { status: limit.status });
  }

  // Bot check: this route costs money per call.
  const verification = await checkBotId();
  if (verification.isBot) {
    return NextResponse.json({ error: "Automated traffic detected." }, { status: 403 });
  }

  // Global daily budget: the hard ceiling on paid LLM calls.
  const budget = await spendLlmBudget();
  if (!budget.ok) {
    return NextResponse.json({ error: budget.error }, { status: budget.status });
  }

  // Call OpenAI
  let aiResponse: Response;
  try {
    aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        max_tokens: 2000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 502 }
    );
  }

  if (!aiResponse.ok) {
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 502 }
    );
  }

  // Parse OpenAI response
  let analysisJson: string;
  try {
    const data = await aiResponse.json();
    analysisJson = data.choices?.[0]?.message?.content ?? "";
  } catch {
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 502 }
    );
  }

  // Strip markdown backticks if present
  analysisJson = analysisJson
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // Parse and validate
  let analysis: EmailAnalysisResponse;
  try {
    const parsedAnalysis = JSON.parse(analysisJson);
    if (
      typeof parsedAnalysis.overallScore !== "number" ||
      !parsedAnalysis.overallLevel ||
      !parsedAnalysis.verdict ||
      !Array.isArray(parsedAnalysis.categories)
    ) {
      throw new Error("Invalid response structure");
    }
    analysis = {
      ...parsedAnalysis,
      analysedAt: new Date().toISOString(),
    };
  } catch {
    return NextResponse.json(
      { error: "Analysis failed. Please try again." },
      { status: 502 }
    );
  }

  return NextResponse.json(analysis);
}
