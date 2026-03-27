# NEST CIPHER — Project Scaffold & Design Foundation

## Context

Building nestcipher.com — a free interactive AI & cybersecurity security toolkit.
Premium dark-theme design, portfolio-grade quality.
Will deploy to Vercel. Domain is on Hostinger (DNS pointed via CNAME later).

## Step 1: Scaffold

Create a Next.js 15 project (App Router, TypeScript, src/ directory) with:

- Tailwind CSS 4 (latest, using @import "tailwindcss" in globals.css)
- Framer Motion for page transitions and UI micro-interactions
- GSAP (gsap + @gsap/react) for scroll-driven hero animation
- next-themes for dark/light mode toggle (dark as default)
- @vercel/analytics (added but not configured yet)
- geist font package (Geist Sans + Geist Mono)

## Step 2: Design Tokens & Tailwind Config

Dark-first theme with these tokens:

- Background: #0A0A0F (primary), #12121A (card/surface), #1A1A25 (elevated)
- Accent cyan: #00D4AA (primary action), #00B894 (hover), #00F5C8 (glow)  
- Warning amber: #F59E0B
- Danger red: #EF4444
- Text: #F1F1F3 (primary), #9CA3AF (secondary), #6B7280 (muted)
- Border: rgba(255,255,255,0.06) (subtle), rgba(255,255,255,0.12) (hover)
- Mono font for code/data: Geist Mono
- Sans font for UI: Geist Sans

Configure Tailwind with these as CSS variables applied via globals.css,
respecting the next-themes data-theme attribute. Include a light mode
fallback but dark is the default and priority.

## Step 3: Layout Shell

Build these layout components in src/components/layout/:

### Navbar (fixed, glassmorphism on scroll)

- Logo: "NEST" in Geist Mono bold + "CIPHER" in Geist Mono light weight
  with a subtle CSS shimmer animation on hover (like encrypted text decoding)
- Nav links: Home, Tools, About, Newsletter
- Mobile hamburger menu with Framer Motion slide-in
- On scroll: add backdrop-blur-xl + bg-opacity transition
  (transparent at top, glassy on scroll). Use a useScrollPosition hook.

### Footer

- Minimal: logo, copyright, "Built by [Agency]" link placeholder,
  social icons (GitHub, X/Twitter, LinkedIn)
- No heavy footer — this is a tool site, not a blog

### PageTransition wrapper

- Framer Motion AnimatePresence wrapping {children} in layout.tsx
- Fade + subtle Y-translate on route change

## Step 4: Homepage (/app/page.tsx)

Build the landing page with these sections:

### Hero Section

- Full viewport height, dark canvas
- Large headline: "Free AI-Powered Security Tools"
  with a typewriter or text-reveal animation (Framer Motion)
- Subheadline: "Scan. Analyze. Protect. — Open tools for developers
  and security professionals."
- Two CTAs: "Explore Tools" (primary, cyan) + "Join Newsletter" (outline)
- Background: animated particle/node mesh using GSAP.
  Subtle dots connected by thin lines, gently floating,
  with a radial glow around the cursor on mousemove.
  This represents a network being scanned. Keep it performant —
  use canvas or limit SVG nodes to <80. requestAnimationFrame loop.

### Tools Grid Section

- Section heading: "Security Toolkit" with a subtle horizontal rule accent
- 3 tool cards in a responsive grid (1 col mobile, 3 col desktop)
- Each card: dark surface bg, subtle border, icon placeholder (use a
  simple SVG icon — shield, scan, book), tool name, one-line description,
  "Coming Soon" badge (amber) or "Launch" button (cyan)
- Cards: hover-lift with Framer Motion (scale 1.02, border glow,
  shadow bloom)
- Card data for now:
  1. "AI Email Analyzer" — "Paste a suspicious email. Get an AI-powered
     threat breakdown in seconds." — Coming Soon
  2. "Security Headers Scanner" — "Enter any URL. Get an instant
     security grade with actionable fixes." — Coming Soon  
  3. "OWASP LLM Top 10" — "Interactive explorer of the most critical
     AI security vulnerabilities." — Coming Soon

### Newsletter CTA Section

- Simple centered section: "Stay sharp." headline
- "Weekly AI security insights. No spam. Unsubscribe anytime."
- Email input + subscribe button (no backend wiring yet —
  just the UI with a placeholder toast on submit)

## Step 5: Tools Index Page (/app/tools/page.tsx)

- Same tool grid as homepage but full-page, with more room
- Add breadcrumb: Home > Tools
- Filter/category tabs placeholder (All, Scanners, AI Tools, Learning)
  — not functional yet, just the UI

## Step 6: About Page (/app/about/page.tsx)  

- Brief mission statement section
- "Who's behind Nest Cipher" — placeholder for personal/agency intro
- Tech stack badges (Next.js, Vercel, OpenAI, etc.) as pill components

## Constraints

- NO placeholder "lorem ipsum" — use real copy as specified above
- NO generic component libraries (no shadcn, no MUI) — hand-built components
- Responsive: mobile-first, breakpoints at sm/md/lg/xl
- All animations must respect prefers-reduced-motion
- Performance: no layout shift, lazy load below-fold sections
- Keep all components modular and typed with proper TypeScript interfaces
- Use server components by default, "use client" only where needed
  (interactivity, animations, hooks)

After scaffolding, run `npm run build` to verify zero errors,
then run `npm run dev` and confirm the site loads on localhost.
