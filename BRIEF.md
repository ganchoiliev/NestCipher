# NEST CIPHER — Tool Build: AI Bias Checker

## Overview

Build an AI bias checker at /tools/ai-bias-checker. Users paste
an AI-generated response or prompt output, the tool analyzes it
for demographic bias, stereotyping, representation gaps, assumption
patterns, and framing bias — then provides a bias score with
specific findings and suggestions for more balanced output.

This is the most educational tool in the toolkit. Nobody has
built a free, accessible version of this. It teaches people
to think critically about AI outputs — which is the core mission
of the entire site.

## Route Structure

### Page: /app/tools/ai-bias-checker/page.tsx

- Server component with metadata
- Title: "AI Bias Checker — Detect Bias in AI Outputs"
- Description: "Analyze AI-generated text for demographic bias,
  stereotyping, and representation gaps. Free, detailed analysis
  with actionable suggestions."

### Client Component: /components/tools/AIBiasChecker.tsx

- "use client" — handles all interactivity

### API Route: /app/api/check-bias/route.ts

- POST endpoint
- Receives { content: string, context?: string }
- Returns structured bias analysis

### Types: /types/ai-bias-checker.ts

## TypeScript Types (/types/ai-bias-checker.ts)

```typescript
export type BiasLevel = 'minimal' | 'low' | 'moderate' | 'significant' | 'high';

export type BiasCategory = 
  | 'demographic'
  | 'stereotyping'
  | 'representation'
  | 'assumption'
  | 'framing';

export interface BiasInstance {
  id: string;
  category: BiasCategory;
  excerpt: string;           // The specific text that exhibits bias
  issue: string;             // What the bias is
  impact: string;            // Why it matters
  suggestion: string;        // How to fix it
  severity: 'low' | 'medium' | 'high';
}

export interface BiasCategoryAnalysis {
  category: BiasCategory;
  name: string;              // Display name
  score: number;             // 0-100 (0 = no bias, 100 = severe bias)
  level: BiasLevel;
  description: string;       // What this category measures
  findings: string[];        // 2-4 observations
  explanation: string;       // Why this matters
}

export interface BiasAnalysis {
  overallScore: number;          // 0-100 (0 = unbiased, 100 = heavily biased)
  overallLevel: BiasLevel;
  verdictText: string;           // One-line summary
  categories: BiasCategoryAnalysis[];  // 5 bias categories
  instances: BiasInstance[];     // Specific bias instances found
  positiveAspects: string[];    // Things the text does well
  rewriteSuggestions: string[]; // 3-5 concrete rewrite suggestions
  summary: string;              // 2-3 sentence summary
  educationalNote: string;      // Teaching the user about AI bias
  analyzedAt: string;
}
```

## API Route (/app/api/check-bias/route.ts)

### Input validation

- POST with JSON body: { content: string, context?: string }
- Content: 50-10000 characters
- Context (optional): additional info like "This was generated
  for a job listing" or "This is a product description for
  skincare" — helps the AI give more targeted analysis
- Return 400 for validation failures

### Rate limiting

- 5 requests per IP per hour (same utility)

### OpenAI System Prompt

You are an expert in AI ethics, fairness, and bias detection.
Your task is to analyze AI-generated text for various forms of
bias and provide constructive, educational feedback.
Analyze the provided text across these 5 bias categories,
scoring each 0-100 (0 = no bias detected, 100 = severe bias):

Demographic Bias: Does the text favor, exclude, or make
assumptions about specific demographic groups based on gender,
age, race, ethnicity, nationality, religion, disability, or
socioeconomic status? Look for: gendered language defaults
("he" for doctor, "she" for nurse), age-based assumptions,
cultural centrism, ability assumptions.
Stereotyping: Does the text reinforce stereotypes about
any group? Look for: associating traits with groups
("women are nurturing", "millennials are lazy"), cultural
stereotypes, professional stereotypes, behavioral
generalizations about demographics.
Representation Gaps: Does the text consistently represent
one perspective while ignoring others? Look for: Western-centric
viewpoints, male-default language, heteronormative assumptions,
able-bodied defaults, English-speaking world focus, urban bias.
Assumption Patterns: Does the text make unstated assumptions
about the reader or subject? Look for: assumed income level,
assumed education level, assumed family structure, assumed
cultural background, assumed technology access, assumed
physical ability.
Framing Bias: How does the text frame issues? Look for:
presenting one perspective as default/normal, using loaded
language, euphemisms that minimize impact on certain groups,
false balance, disproportionate emphasis, passive voice to
obscure responsibility.

For each category provide:

Score from 0 (no bias) to 100 (severe bias)
Level: "minimal" (0-15), "low" (16-35), "moderate" (36-60),
"significant" (61-80), "high" (81-100)
Description of what this category measures (1 sentence)
2-4 specific findings from the text
Explanation of why this matters (1-2 sentences)

Also identify specific bias INSTANCES in the text:

For each biased statement or phrase, provide:

The exact excerpt from the text
Which bias category it falls under
What the issue is (1 sentence)
Why it matters / its impact (1 sentence)
A concrete suggestion for improvement (rewrite the excerpt)
Severity: low (subtle/unconscious), medium (noticeable),
high (overt/harmful)

Also provide:

2-3 positive aspects: things the text does WELL in terms
of fairness and inclusion (even biased text usually has
some positive elements)
3-5 concrete rewrite suggestions: specific ways to make
the text more balanced and inclusive
An educational note (2-3 sentences) teaching the user
about the specific type of bias found in this text

Calculate overall bias score as weighted average:

Demographic Bias: 25%
Stereotyping: 25%
Representation Gaps: 20%
Assumption Patterns: 15%
Framing Bias: 15%

Important guidelines:

Be constructive, not accusatory. The goal is education,
not shaming.
Acknowledge that some bias is unconscious and systemic —
it doesn't mean the author is biased.
Don't flag accurate demographic data as bias (e.g. if a
medical text discusses conditions that disproportionately
affect certain groups, that's not bias — that's accuracy).
Context matters: a text about women's health targeting
women is not "excluding men" — use common sense.
If the text is genuinely well-balanced and unbiased, say so
clearly with low scores and positive feedback. Don't
manufacture findings.
Short texts naturally have less data to analyze — adjust
confidence accordingly.

Respond ONLY with valid JSON matching this structure
(no markdown, no backticks):
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
If the user provides additional context about the text's purpose,
use it to calibrate your analysis.

## Client UI Implementation

### Layout

Full-width, max-w-4xl centered container.

**Top section:**

- Breadcrumb: Home / Tools / AI Bias Checker
- H1: "AI Bias Checker" (mono font)
- Subtitle: "Paste AI-generated text below — job listings,
  product descriptions, marketing copy, chatbot responses —
  and we'll analyze it for bias and suggest improvements."
- Small note: "Your text is analyzed securely and never stored."

### Input section

- Large textarea (same styling)
  - Placeholder: "Paste AI-generated text here — e.g. a job
    description, product copy, chatbot response, article,
    or any AI output you want to check for bias..."
  - Min height: 200px
  - Character count: "0 / 10,000"
- Optional context input (smaller textarea or text input):
  - Label: "Context (optional)"
  - Placeholder: "What is this text for? e.g. 'Job listing
    for a software engineer' or 'Product description for
    skincare targeting all genders'"
  - This helps the AI calibrate its analysis
  - Max 500 characters
  - Collapsible — show a "Add context" link that reveals
    the field. Keeps the default UI clean.
- "Check for Bias" button (cyan)
  - Loading: "Analyzing..." with pulse

### Loading State

- Skeleton loader
- Phased text:
  - "Scanning for demographic patterns..."
  - "Checking for stereotyping and assumptions..."
  - "Analyzing representation and framing..."
  - "Generating improvement suggestions..."

### Results Section

#### 1. Overall Score (centered)

- Score circle with colour coding:
  - Minimal (0-15): cyan (#00D4AA)
  - Low (16-35): green (#22C55E)
  - Moderate (36-60): amber (#F59E0B)
  - Significant (61-80): orange (#F97316)
  - High (81-100): red (#EF4444)
- NOTE: For this tool, LOWER is better. The score circle should
  feel POSITIVE for low scores (unlike the email analyzer
  where high = bad). Make sure the colour coding and messaging
  reinforce this — green/cyan for low bias is good.
- Verdict badge + verdict text
- "What does this score mean?" collapsible explainer

#### 2. Bias Categories (5 cards)

- Section heading: "Bias Analysis"
- 5 cards in a single column with:
  - Category name (mono, bold) + level badge
  - Score bar (colour-coded, animated)
  - Score: "35/100"
  - Findings as bullet list
  - Explanation text
  - Left border colour matches the level

#### 3. Specific Bias Instances (THE KEY FEATURE)

- Section heading: "Bias Instances Found" (or "No Bias
  Instances Found" if empty)
- Each instance as a card:
  - Severity badge (low=green, medium=amber, high=red)
  - Category badge
  - "Excerpt" in a highlighted quote block (mono, with
    quotation marks or indent)
  - "Issue": what's wrong
  - "Impact": why it matters
  - "Suggested rewrite": the improved version in a
    green-bordered block — showing the user exactly how
    to fix it
- This side-by-side of "problematic → improved" is the
  most useful part of the tool

#### 4. Positive Aspects

- Section heading: "What This Text Does Well"
- Green-bordered card with checkmark icons
- This is important — the tool should not feel like it's
  only criticizing. Acknowledging positives builds trust
  and makes the critique more credible.

#### 5. Rewrite Suggestions

- Section heading: "How to Improve"
- Numbered list (cyan numbers, same as other tools)
- These should be specific to THIS text, not generic advice

#### 6. Educational Note

- Section heading: "Understanding AI Bias"
- Cyan-bordered card with the educational content
- Specific to the TYPE of bias found in this text

#### 7. Action Buttons

- "Check Another" (outline) — clears everything
- "Copy Report" (outline) — formatted plain text

### Empty State

- "Paste AI-generated text above to check for bias"
- Three feature hints:
  - "5 bias categories"
  - "Specific instance detection"  
  - "Rewrite suggestions"
- Opacity 0.4

## Update /tools page and homepage

- Add AI Bias Checker tool card:
  - Icon: scales/balance icon or an eye with equals sign
  - Title: "AI Bias Checker"
  - Description: "Detect bias in AI outputs with specific
    instances and rewrite suggestions."
  - "Launch" badge
  - Link to /tools/ai-bias-checker
- Tools grid now shows 6 tools (2 rows of 3)

## Testing

1. npm run build — zero errors
2. Test with a biased job listing: "We are looking for a
   young, energetic rockstar developer. He should have 10+
   years of experience and be willing to work in our
   fast-paced office. The ideal candidate is a culture fit
   who enjoys beer Fridays and ping pong."
   — should score 50+ with demographic, stereotyping,
   and assumption findings
3. Test with a well-written inclusive text — should score
   under 25 with positive feedback
4. Test with context provided — should give more targeted
   analysis
5. Verify the "problematic → suggested rewrite" format
   for instances
6. Verify "Check Another" clears everything
7. Verify /tools page shows 6 tools
8. Test mobile layout

## Constraints

- Same patterns as all other tools: rate limiter, error
  handling, never store content, OpenAI via fetch
- The tone must be CONSTRUCTIVE, not accusatory. This tool
  educates, it doesn't shame. The system prompt reinforces
  this but the UI should too — use positive framing like
  "How to Improve" not "What's Wrong"
- The "Positive Aspects" section is mandatory — even heavily
  biased text should get acknowledged for anything it does
  well. This builds user trust.
- Lower score = better (unlike email analyzer). Make sure
  the UI messaging is consistent with this.
- The optional context field is a differentiator — it lets
  users tell the AI "this is a job listing" or "this targets
  women" so the analysis is calibrated. Keep it optional
  but visible.

## Animations

- Same patterns as other tools
- Instance cards: staggered entrance
- "Problematic → Improved" comparison should have a subtle
  transition effect — the problematic excerpt fades slightly
  and the improvement slides in beside/below it
- All respect prefers-reduced-motion

## Responsive

- Mobile: single column, instance cards full width,
  comparison blocks stack vertically
- Desktop: max-w-4xl, comfortable spacing
