# Drupal 11 WCAG / Section 508 Custom Module

A headless Drupal 11 paragraph module + Next.js frontend that scans web content for WCAG 2.1 AA and Section 508 accessibility violations using Playwright and axe-core.

## What it does

- **URL Scanner** — paste any public URL, Playwright loads the live page in a headless Chromium browser and axe-core audits the fully rendered DOM
- **HTML Inspector** — paste HTML from your browser's Inspect panel (right-click → Inspect), optionally include CSS for color contrast evaluation
- Results are grouped by severity: critical, serious, moderate, minor
- Passed rules are listed in a collapsible section so reviewers can see what was verified
- Rules that axe-core cannot automatically pass or fail are flagged for manual review
- Download results as JSON or CSV

## Accuracy

Automated tools including Playwright + axe-core detect approximately **57% of WCAG 2.1 AA criteria**. Color contrast (without CSS), meaningful alt text, logical reading order, focus management, and cognitive accessibility require human review. This follows the same methodology as Deque axe DevTools and Siteimprove.

## Stack

| Layer | Technology |
|-------|-----------|
| CMS | Drupal 11 (headless) |
| Paragraph type | `francisco_wcag_checker` |
| Scanning engine | Playwright (Chromium) + axe-core |
| Frontend | Next.js 15 App Router (TypeScript) |
| Styling | Inline CSS, dark theme, violet accent |

## WCAG tags evaluated

`wcag2a` `wcag2aa` `wcag21a` `wcag21aa` `wcag22aa` `section508` `best-practice`

---

## Repository structure

```
drupal-module/
  francisco_wcag_checker/       # Drop into web/modules/custom/
    francisco_wcag_checker.info.yml
    francisco_wcag_checker.install
    config/install/             # Self-contained — installs via drush en alone
  config/                       # Drupal site config exports (for reference)

nextjs/
  api/
    wcag-scan-url/route.ts      # POST handler — URL scan via Playwright
    wcag-scan-html/route.ts     # POST handler — HTML/CSS scan via Playwright
  components/
    wcag-checker/
      types.ts                  # TypeScript interfaces
      WcagChecker.tsx           # React component (client)
      index.ts                  # Named re-export
```

---

## Installation

### Drupal module

1. Copy `drupal-module/francisco_wcag_checker/` into your Drupal site at `web/modules/custom/`
2. Run `drush en francisco_wcag_checker --yes`
3. Run `drush cr`

The module self-installs the paragraph type, heading label field, and registers itself on `field_components` for your content types via `hook_install`.

### Next.js

1. Install dependencies:
   ```bash
   npm install playwright @axe-core/playwright
   npx playwright install chromium
   ```

2. Add to `next.config.ts`:
   ```ts
   serverExternalPackages: ["playwright", "playwright-core", "@axe-core/playwright"]
   ```

3. Copy the `nextjs/api/` routes into `src/app/api/`
4. Copy `nextjs/components/wcag-checker/` into `src/components/paragraphs/wcag-checker/`
5. Wire the component into your paragraph renderer:
   ```tsx
   import { WcagChecker } from "@/components/paragraphs/wcag-checker";
   // case "paragraph--wcag_checker": return <WcagChecker data={paragraph.data} />;
   ```

### Docker / production

Switch your base image from `node:20-alpine` to `node:20-slim` (Debian). Alpine is missing the system libraries Chromium requires. Install the Chromium dependencies during build:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libdbus-1-3 libxkbcommon0 libx11-6 libxcomposite1 \
    libxdamage1 libxext6 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libatspi2.0-0 \
  && rm -rf /var/lib/apt/lists/*
```

---

## Author

Francisco Guardado
