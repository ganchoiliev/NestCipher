# NEST CIPHER — Polish Pass: OWASP LLM Top 10 Explorer

## Overview

Add approachability improvements to the OWASP LLM Top 10 Explorer
at /tools/owasp-llm-top-10. The explorer already works well —
this pass makes it more welcoming to non-technical users and
adds visual polish to the quiz.

## 1. Difficulty Indicator on Each Card

In the collapsed card view, add a small "Complexity" indicator
below the summary text:

- "Easy to understand" (for LLM01 Prompt Injection, LLM02
  Sensitive Info, LLM07 System Prompt Leakage, LLM09 Misinformation)
- "Moderate" (for LLM05 Improper Output Handling, LLM06 Excessive
  Agency, LLM10 Unbounded Consumption)
- "Technical" (for LLM03 Supply Chain, LLM04 Data Poisoning,
  LLM08 Vector Embeddings)

Display as a small muted text label with a dot indicator:

- Easy: green dot + "Beginner friendly"
- Moderate: amber dot + "Some technical knowledge helpful"
- Technical: blue dot + "Requires development background"

This helps non-technical visitors know which cards to start with.

## 2. "Start Here" Highlight

Add a subtle "Start here" badge on the first Critical card
(Prompt Injection — LLM01) for first-time visitors. This gives
new users a clear entry point instead of facing 10 cards and
not knowing where to begin.

- Small cyan outline badge: "Start here →"
- Positioned next to the expand chevron
- Only show on initial page load — once any card has been
  expanded, hide it (use local component state, not localStorage)

## 3. Quiz Mode — Difficulty Feedback

After each quiz answer is submitted, in addition to the
existing explanation, add a small "Difficulty" tag on
the question:

- If <30% of concepts in the question require technical
  knowledge: "Introductory question"
- If 30-60%: "Intermediate question"
- If >60%: "Advanced question"

This is pre-tagged in the data — add a `difficulty` field
to each quiz entry in the data file:

- LLM01 (Prompt Injection): "introductory"
- LLM02 (Sensitive Info): "introductory"
- LLM03 (Supply Chain): "advanced"
- LLM04 (Data Poisoning): "intermediate"
- LLM05 (Output Handling): "intermediate"
- LLM06 (Excessive Agency): "intermediate"
- LLM07 (System Prompt): "introductory"
- LLM08 (Embeddings): "advanced"
- LLM09 (Misinformation): "introductory"
- LLM10 (Unbounded Consumption): "intermediate"

Display as a small pill next to the vulnerability ID
in quiz mode after the answer is revealed.

## 4. Quiz Results — Breakdown by Difficulty

On the quiz results screen, below the score circle,
add a mini breakdown:

- "Introductory: 3/4 correct"
- "Intermediate: 2/3 correct"  
- "Advanced: 1/2 correct"

This helps users understand WHERE their knowledge gaps are,
not just the total score. Use the same green/red colour
coding as the answer list.

## 5. Reading Time Estimate

In each expanded card, at the top of the expanded content
(before the description), add:

- "~2 min read" (estimate based on content length —
  roughly 200 words per minute)
- Small muted text, positioned right-aligned
- This sets expectations and encourages users to
  actually read the full card

Calculate this from the combined length of description +
realWorldExample + impact + mitigations text.

## 6. Progress Tracker (Optional Enhancement)

At the top of the Explorer mode (below the filter pills),
add a subtle progress indicator:

- "You've explored X of 10 vulnerabilities"
- Track which cards have been expanded during this session
  (component state only — no persistence)
- Small progress bar below the text (same style as quiz
  progress bar)
- This gamifies the exploration and encourages users to
  read all 10

## Constraints

- Don't break existing accordion, filter, or quiz functionality
- All new elements should be subtle — they enhance,
  not clutter
- All text must be accurate and educational
- Respect prefers-reduced-motion for any new animations
- Mobile: all new elements must work at 390px width
- Run `npm run build` — zero errors
- Keep the data file changes minimal — only add the
  `difficulty` field to each vulnerability entry
