import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { checkBotId } from "botid/server";
import { checkRouteLimit, spendLlmBudget } from "@/lib/limits";
import { runEmailPrepass } from "@/lib/email-prepass";
import {
  applyPrepassFloor,
  buildUserMessage,
  EMAIL_ANALYSIS_RESPONSE_FORMAT,
  parseModelAnalysis,
  SYSTEM_PROMPT,
} from "@/lib/email-analysis";

// Layer order (docs/THREAT-MODEL.md A2/A3): WAF (edge) → schema → durable
// per-IP limit → bot check → global daily budget → provider. The
// deterministic pre-pass floors the verdict; the model cannot lower it.
// Refusals, truncation and unparseable replies are inconclusive (502),
// never "safe".

const BodySchema = z.object({
  emailContent: z
    .string()
    .trim()
    .min(10, "Please paste a longer email — at least 10 characters are needed for analysis.")
    .max(15000, "Email content is too long. Please limit to 15,000 characters."),
});

const INCONCLUSIVE = {
  error:
    "Analysis could not be completed reliably. Treat the email with caution and try again.",
};

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

  // Deterministic pre-pass: flags and verdict floor the model cannot lower.
  const prepass = runEmailPrepass(content);

  // Call OpenAI with structured outputs (strict JSON schema).
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
        response_format: EMAIL_ANALYSIS_RESPONSE_FORMAT,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage(content) },
        ],
      }),
    });
  } catch {
    return NextResponse.json(INCONCLUSIVE, { status: 502 });
  }

  if (!aiResponse.ok) {
    return NextResponse.json(INCONCLUSIVE, { status: 502 });
  }

  let modelText: string;
  try {
    const data = await aiResponse.json();
    const choice = data.choices?.[0];
    // A refusal or a truncated reply is inconclusive, never "safe".
    if (!choice || choice.message?.refusal || choice.finish_reason !== "stop") {
      return NextResponse.json(INCONCLUSIVE, { status: 502 });
    }
    modelText = choice.message?.content ?? "";
  } catch {
    return NextResponse.json(INCONCLUSIVE, { status: 502 });
  }

  const analysis = parseModelAnalysis(modelText);
  if (analysis === null) {
    return NextResponse.json(INCONCLUSIVE, { status: 502 });
  }

  const final = applyPrepassFloor(analysis, prepass);
  return NextResponse.json({ ...final, analysedAt: new Date().toISOString() });
}
