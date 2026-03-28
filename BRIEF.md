# NEST CIPHER — Polish Pass: Security Headers Scanner

## Overview

Add loading states, skeleton animations, and micro-explainer
tooltips to the Security Headers Scanner at /tools/headers-scanner.
The goal is to make the tool feel responsive during the scan and
more approachable for non-technical users.

## 1. Loading State — Scan in Progress

When the user clicks "Scan" and the API is processing:

### Skeleton loader

- Below the input, show a skeleton shimmer animation where
  the results will appear:
  - A pulsing circle placeholder (where the grade circle will be)
  - Below it: 3-4 rectangular skeleton bars (where header cards
    will appear)
  - Use a subtle shimmer effect — a gradient that slides
    left-to-right across the skeleton elements
  - Skeleton colours: bg-[#1A1A25] (surface) with a lighter
    shimmer sweep of rgba(255,255,255,0.03)
  - The skeleton should appear with a fade-in (200ms)

### Scan button state

- Text changes to "Scanning..."
- Add a subtle pulse animation on the button (opacity 0.7 to 1,
  looping, 1.5s)
- Button is disabled (no pointer events, reduced opacity)
- Textarea/input is disabled during scan

### Progress indicator (optional but nice)

- Small text below the input during scan:
  "Fetching headers from [domain]..." in muted colour
- This gives the user confidence something is happening

## 2. Micro-Explainer Tooltips

Add a small info icon (ⓘ) next to each header name in the
results breakdown. When clicked or hovered, it shows a
one-sentence plain-English explanation of what that header does.

These should be SHORT — one sentence max. Not the technical
description that's already shown, but a "talk to me like
I'm not a developer" version:

- Strict-Transport-Security: "Forces your browser to always
  use a secure HTTPS connection."
- Content-Security-Policy: "Controls what scripts and resources
  a website is allowed to load."
- X-Content-Type-Options: "Stops browsers from guessing file
  types, which can be exploited."
- X-Frame-Options: "Prevents other websites from embedding
  this site in a hidden frame."
- Referrer-Policy: "Controls how much information your browser
  shares when you click a link."
- Permissions-Policy: "Limits which device features
  (camera, mic, location) a site can access."
- X-XSS-Protection: "Legacy protection against script injection
  — modern sites use CSP instead."
- Cross-Origin-Opener-Policy: "Isolates this site's window from
  other sites for extra security."
- Cross-Origin-Resource-Policy: "Controls whether other websites
  can load this site's files."
- Cross-Origin-Embedder-Policy: "Ensures all loaded resources
  have explicitly granted permission."

### Tooltip implementation

- Use a simple click-toggle (not hover — hover doesn't work
  on mobile)
- Small popover that appears below/beside the info icon
- Dark surface bg with subtle border, rounded corners
- Close on click outside or clicking the icon again
- Framer Motion fade + scale animation (150ms)
- Max width: 280px so it doesn't overflow on mobile

## 3. Grade Explanation

Below the grade circle, after the score (e.g. "90 / 100"),
add a one-line contextual explanation based on the grade:

- A+: "Excellent. This site implements all recommended
  security headers."
- A: "Strong security posture with minor improvements possible."
- B: "Good foundation, but several important headers are missing."
- C: "Moderate risk. Multiple security headers need attention."
- D: "Weak security. Most recommended headers are not configured."
- F: "Critical gaps. This site is missing essential
  security protections."

This text should appear below the score in secondary/muted colour.

## 4. Result Summary Card

At the top of the results (between the grade circle and
the header cards), add a compact summary bar:

- A horizontal row showing:
  "X passed · Y failed · Z partial"
  with green/red/amber dots respectively
- Compact, single line, muted text
- This gives an instant overview before diving into individual cards

## Constraints

- Don't break any existing functionality
- All animations must respect prefers-reduced-motion
- Skeleton loader should be a reusable component
  (we'll use it for the email analyzer polish too)
- Keep the info icon small (14-16px) and unobtrusive —
  it should not compete with the header name visually
- Test on mobile — tooltips must not overflow the viewport
- Run `npm run build` — zero errors
