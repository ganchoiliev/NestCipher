# NEST CIPHER — Homepage Fixes

## 1. Add Missing Tool Card

The Prompt Injection Tester is missing from the homepage tool
grid. Add it so all 6 tools are displayed on the homepage
(2 rows of 3). Use the same card format as the other tools:

- Icon: shield icon (same as on /tools page)
- Title: "Prompt Injection Tester"
- Description: "Test your AI system prompt against 12 known
  injection attacks and get hardening recommendations."
- "Launch" badge
- Link to /tools/prompt-injection-tester

## 2. Add OG Meta Tags to Homepage

In app/layout.tsx or the homepage page.tsx, add these meta tags:

```tsx
<meta property="og:title" content="Nest Cipher — Free AI-Powered Security Tools" />
<meta property="og:description" content="Free security toolkit for developers. Scan headers, detect phishing, test prompt injections, check AI content and bias. No sign-ups, no ads, no cookies." />
<meta property="og:url" content="https://nestcipher.com" />
<meta property="og:site_name" content="Nest Cipher" />
<meta property="og:type" content="website" />
<meta property="og:image" content="https://nestcipher.com/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
```

## 3. Add Twitter Card Meta Tags

```tsx
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Nest Cipher — Free AI-Powered Security Tools" />
<meta name="twitter:description" content="Free security toolkit for developers. Scan headers, detect phishing, test prompt injections, check AI content and bias." />
<meta name="twitter:image" content="https://nestcipher.com/og-image.png" />
```

## 4. Create OG Image

Create a simple, clean OG image (1200x630px) and save it to
/public/og-image.png. The image should be:

- Dark background matching the site theme (#0A0A12)
- NESTCIPHER logo/text at the top (same mono font style)
- Tagline: "Free AI-Powered Security Tools"
- Below: 6 small icon representations of the tools in a row
- Clean, minimal, professional
- Generate this as an SVG first, then convert to PNG

Alternatively, create it as a simple HTML page that can be
screenshotted, or use a canvas-based approach.

NOTE: If generating an image programmatically is complex,
create a minimal version: dark bg, white "NESTCIPHER" text,
subtitle "Free AI-Powered Security Tools", and the URL.
That's sufficient for social sharing.

## 5. Add Canonical URL

In the homepage metadata:

```tsx
<link rel="canonical" href="https://nestcipher.com" />
```

## 6. Fix Newsletter Form

The newsletter form currently has no action — clicking
Subscribe does nothing.

For now, implement a simple client-side handler that:

- Validates the email address
- Shows a success message: "Thanks for subscribing!
  We'll send you weekly AI security insights."
- Stores nothing (we'll connect a real email service later)
- This is a placeholder that acknowledges the user's action
  instead of silently doing nothing

Later we'll connect it to a service like Buttondown,
Resend, or ConvertKit. But for now, at minimum, show
feedback when someone clicks Subscribe.

Alternatively, if you want a real solution NOW:

- Use Buttondown (buttondown.com) — free tier, simple API
- Form action: POST to Buttondown's subscribe endpoint
- No backend needed — it's a form action

For the simplest approach: make the form POST to a
Buttondown subscribe URL, or show a "Coming soon" toast
instead of silently failing.

## 7. Add JSON-LD Structured Data

In the homepage <head>, add:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "Nest Cipher",
  "url": "https://nestcipher.com",
  "description": "Free AI-powered security toolkit for developers and security professionals.",
  "applicationCategory": "SecurityApplication",
  "operatingSystem": "Web",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "GBP"
  },
  "author": {
    "@type": "Organization",
    "name": "GoSmartR",
    "url": "https://gosmartr.co.uk"
  }
}
</script>
```

## Constraints

- Don't break any existing page content or styling
- OG image must be exactly 1200x630px for optimal
  social media display
- All meta tags should use Next.js metadata API where possible
- Run npm run build — zero errors

Issue #6 (newsletter) — your call: either implement a real email service connection (Buttondown is free and takes 10 minutes) or just show a success toast as a placeholder. Either way, the form can't silently do nothing.
Priority order: Fix #2, #3, #4 first (OG tags + image) — these affect your LinkedIn post tomorrow morning. Then #1 (missing tool), #6 (newsletter), #5 and #7 (SEO).
