<script defer data-domain="nestcipher.com" src="https://plausible.io/js/script.js"></script>

```

**Step 3: Claude Code prompt to integrate it**
```

# NEST CIPHER — Plausible Analytics Integration

Add Plausible analytics to nestcipher.com. This replaces any
existing Vercel Analytics.

## Changes needed

### 1. Remove Vercel Analytics

- Remove @vercel/analytics package import and <Analytics />
  component from the root layout (app/layout.tsx)
- Keep the package installed (no harm) but remove the component

### 2. Add Plausible script

In app/layout.tsx, add this script tag inside the <head> section
(use Next.js Script component):

```tsx
import Script from 'next/script'

// Inside the <head> or at the top of <body>:
<!-- Privacy-friendly analytics by Plausible -->
<script async src="https://plausible.io/js/pa-FOyFgrwIcEk2zlKADZTcX.js"></script>
<script>
  window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};
  plausible.init()
</script>

### 3. That's it
No cookies, no GDPR banner needed, no consent required.
This aligns with the site's privacy-first positioning.

Run `npm run build` — zero errors.
