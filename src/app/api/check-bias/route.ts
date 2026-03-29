import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limiter";

const SYSTEM_PROMPT = `You are an expert in AI ethics, fairness, and bias detection. Your task is to analyze AI-generated text for various forms of bias and provide constructive, educational feedback.

Analyze the provided text across these 5 bias categories, scoring each 0-100 (0 = no bias detected, 100 = severe bias):

1. **Demographic Bias**: Does the text favor, exclude, or make assumptions about specific demographic groups based on gender, age, race, ethnicity, nationality, religion, disability, or socioeconomic status? Look for: gendered language defaults ("he" for doctor, "she" for nurse), age-based assumptions, cultural centrism, ability assumptions.

2. **Stereotyping**: Does the text reinforce stereotypes about any group? Look for: associating traits with groups ("women are nurturing", "millennials are lazy"), cultural stereotypes, professional stereotypes, behavioral generalizations about demographics.

3. **Representation Gaps**: Does the text consistently represent one perspective while ignoring others? Look for: Western-centric viewpoints, male-default language, heteronormative assumptions, able-bodied defaults, English-speaking world focus, urban bias.

4. **Assumption Patterns**: Does the text make unstated assumptions about the reader or subject? Look for: assumed income level, assumed education level, assumed family structure, assumed cultural background, assumed technology access, assumed physical ability.

5. **Framing Bias**: How does the text frame issues? Look for: presenting one perspective as default/normal, using loaded language, euphemisms that minimize impact on certain groups, false balance, disproportionate emphasis, passive voice to obscure responsibility.

For each category provide:
- Score from 0 (no bias) to 100 (severe bias)
- Level: "minimal" (0-15), "low" (16-35), "moderate" (36-60), "significant" (61-80), "high" (81-100)
- Description of what this category measures (1 sentence)
- 2-4 specific findings from the text
- Explanation of why this matters (1-2 sentences)

Also identify specific bias INSTANCES in the text. For each biased statement or phrase, provide:
- A unique id (e.g. "bias-1", "bias-2")
- The exact excerpt from the text
- Which bias category it falls under
- What the issue is (1 sentence)
- Why it matters / its impact (1 sentence)
- A concrete suggestion for improvement (rewrite the excerpt)
- Severity: low (subtle/unconscious), medium (noticeable), high (overt/harmful)

Also provide:
- 2-3 positive aspects: things the text does WELL in terms of fairness and inclusion (even biased text usually has some positive elements)
- 3-5 concrete rewrite suggestions: specific ways to make the text more balanced and inclusive
- An educational note (2-3 sentences) teaching the user about the specific type of bias found in this text

Calculate overall bias score as weighted average:
- Demographic Bias: 25%
- Stereotyping: 25%
- Representation Gaps: 20%
- Assumption Patterns: 15%
- Framing Bias: 15%

Important guidelines:
- Be constructive, not accusatory. The goal is education, not shaming.
- Acknowledge that some bias is unconscious and systemic — it doesn't mean the author is biased.
- Don't flag accurate demographic data as bias (e.g. if a medical text discusses conditions that disproportionately affect certain groups, that's not bias — that's accuracy).
- Context matters: a text about women's health targeting women is not "excluding men" — use common sense.
- If the text is genuinely well-balanced and unbiased, say so clearly with low scores and positive feedback. Don't manufacture findings.
- Short texts naturally have less data to analyze — adjust confidence accordingly.

Respond ONLY with valid JSON matching this structure (no markdown, no backticks):
{
  "overallScore": <number 0-100>,
  "overallLevel": "<minimal|low|moderate|significant|high>",
  "verdictText": "<one sentence summary>",
  "categories": [
    {
      "category": "<demographic|stereotyping|representation|assumption|framing>",
      "name": "<display name>",
      "score": <number 0-100>,
      "level": "<level>",
      "description": "<what this measures>",
      "findings": ["<finding 1>", "<finding 2>"],
      "explanation": "<why this matters>"
    }
  ],
  "instances": [
    {
      "id": "<unique id>",
      "category": "<category>",
      "excerpt": "<exact text from input>",
      "issue": "<what the bias is>",
      "impact": "<why it matters>",
      "suggestion": "<concrete rewrite>",
      "severity": "<low|medium|high>"
    }
  ],
  "positiveAspects": ["<positive 1>", "<positive 2>"],
  "rewriteSuggestions": ["<suggestion 1>", "<suggestion 2>"],
  "summary": "<2-3 sentence summary>",
  "educationalNote": "<2-3 sentences about AI bias in this context>"
}

If the user provides additional context about the text's purpose, use it to calibrate your analysis.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Service temporarily unavailable. Please try again later." },
      { status: 503 }
    );
  }

  let body: { content?: string; context?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const content = body.content?.trim() ?? "";
  const context = body.context?.trim() ?? "";

  if (content.length < 50) {
    return NextResponse.json(
      { error: "Please paste at least 50 characters (a few sentences) for accurate analysis." },
      { status: 400 }
    );
  }

  if (content.length > 10_000) {
    return NextResponse.json(
      { error: "Please limit text to 10,000 characters." },
      { status: 400 }
    );
  }

  if (context.length > 500) {
    return NextResponse.json(
      { error: "Please limit context to 500 characters." },
      { status: 400 }
    );
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const { allowed } = checkRateLimit(ip, 5, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json(
      { error: "Rate limit reached. You can check up to 5 texts per hour. Please try again later." },
      { status: 429 }
    );
  }

  let userMessage = content;
  if (context) {
    userMessage = `Text to analyze:\n${content}\n\nContext: ${context}`;
  }

  try {
    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 4000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("OpenAI API error:", errText);
      return NextResponse.json(
        { error: "Analysis failed. Please try again." },
        { status: 502 }
      );
    }

    const data = await aiResponse.json();
    let analysisJson = data.choices?.[0]?.message?.content ?? "";

    // Strip markdown backticks if present
    analysisJson = analysisJson
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const analysis = {
      ...JSON.parse(analysisJson),
      analyzedAt: new Date().toISOString(),
    };

    return NextResponse.json(analysis);
  } catch (err) {
    console.error("Bias analysis error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
