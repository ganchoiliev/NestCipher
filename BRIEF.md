# NEST CIPHER — Polish Pass: AI Email Analyzer

## Overview

Add loading states, skeleton animation, and approachability
improvements to the AI Email Analyzer at /tools/email-analyzer.
This tool has the longest wait time (3-8 seconds for OpenAI response)
so the loading state is the most impactful improvement.

## 1. Loading State — Analysis in Progress

When the user clicks "Analyze Email" and the API is processing:

### Skeleton loader

- Below the textarea, show a rich skeleton animation where
  results will appear:
  - A pulsing circle placeholder (where the score circle will be)
  - Below it: a horizontal row of 6 small rectangular skeleton
    bars in 2x3 grid (where category cards will appear)
  - Below that: 3 narrow skeleton bars (where red flags will appear)
  - Use the same shimmer effect as the headers scanner skeleton
  - Fade-in on mount (200ms)

### Progress feedback

- Below the textarea during analysis, show animated text:
  - Phase 1 (0-2s): "Scanning email content..."
  - Phase 2 (2-4s): "Analyzing threat indicators..."
  - Phase 3 (4-6s): "Generating security report..."
  - Phase 4 (6s+): "Almost done..."
  - Each phase fades in/out with a subtle transition
  - Use a useEffect with setInterval to cycle through phases
  - Cyan text colour, small font

### Button state

- Text changes to "Analyzing..." with pulse animation
- Button disabled, textarea disabled
- Both visually dimmed (opacity 0.5)

## 2. Category Card Score Bars — Animated Fill

The category cards already show horizontal score bars.
Add an animation so the bar width fills from 0 to the
final score over 0.8s with ease-out timing. This should
trigger when the results first appear (not on every render).

Use Framer Motion's `initial={{ width: 0 }}` and
`animate={{ width: score% }}` with a stagger delay
matching the card entrance animation.

## 3. Verdict Emphasis

The verdict text below the score circle is important but
currently blends in. Make it stand out more:

- Slightly larger font (text-lg)
- Add a left border accent (2px, colour matches the
  overall threat level — cyan for safe, green for low,
  amber for medium, orange for high, red for critical)
- Add subtle padding-left (pl-4)
- This creates a "pull quote" effect that draws the eye

## 4. "What does this score mean?" Explainer

Below the score circle and verdict, add a collapsible
explanation section:

- Small clickable text: "What does this score mean?"
  with a chevron
- When expanded, show:
  - "0-15: Safe — No significant phishing indicators found."
  - "16-35: Low — Minor suspicious elements, likely legitimate."
  - "36-60: Medium — Some phishing indicators present.
    Exercise caution."
  - "61-85: High — Strong phishing indicators. Do not interact
    with this email."
  - "86-100: Critical — This is almost certainly a phishing
    attempt or scam."
  - Highlight the row that matches the current score
- Collapsed by default — keeps the UI clean but available
  for users who want context

## 5. Suspicious Elements — Type Icons

The suspicious elements section shows type badges (link, sender,
language, etc.). Add small inline SVG icons before each type:

- link: chain/link icon (two interlocked ovals)
- sender: @ symbol icon
- attachment: paperclip icon
- language: text/Aa icon
- impersonation: mask/shield icon
- other: warning triangle icon

Keep icons simple — 16x16px, stroke-based, using
currentColor so they match the text. Don't use emoji.

## 6. Empty State Enhancement

When the tool first loads (no analysis yet), the area below
the textarea is just empty space. Add a subtle empty state:

- Centered muted text: "Paste an email above to get started"
- Below it: three small feature highlights in a row:
  - "6 threat categories"
  - "AI-powered analysis"
  - "Instant results"
- Each with a small icon (shield, brain, zap)
- Very muted — opacity 0.4 — this is a hint, not a feature
  showcase
- Disappears when results or loading state appears

## Constraints

- Reuse the skeleton shimmer component from the scanner polish
- Don't break existing functionality (especially the
  "Analyze Another" reset)
- All animations respect prefers-reduced-motion
- The phased loading text must use component state with
  cleanup (clear the interval on unmount or when results arrive)
- Test the full flow: paste email → loading skeleton + phased
  text → results render → Analyze Another → back to empty state
- Mobile: all new elements must work at 390px
- Run `npm run build` — zero errors
