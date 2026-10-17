import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

export const maxDuration = 60;

const MAX_HTML_BYTES = 500_000; // 500 KB

function buildDocument(html: string, css?: string): string {
  const trimmed = html.trim();
  const isFullDocument =
    trimmed.toLowerCase().startsWith("<!doctype") ||
    trimmed.toLowerCase().startsWith("<html");

  const styleTag = css ? `<style>${css}</style>` : "";

  if (isFullDocument) {
    // Inject CSS before </head> if present, otherwise before </body>
    if (css) {
      if (/<\/head>/i.test(trimmed)) {
        return trimmed.replace(/<\/head>/i, `${styleTag}</head>`);
      }
      return trimmed.replace(/<\/body>/i, `${styleTag}</body>`);
    }
    return trimmed;
  }

  // Wrap fragment in a semantically complete document so document-level
  // axe rules (landmark-one-main, page-has-heading-one, region) don't fire
  // as false positives against the fragment's surrounding shell.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WCAG Fragment Audit</title>
  <style>
    .audit-skip-link { position: absolute; left: -9999px; }
    .audit-heading { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }
  </style>
  ${styleTag}
</head>
<body>
  <a class="audit-skip-link" href="#audit-main">Skip to content</a>
  <main id="audit-main">
    <h1 class="audit-heading">Fragment Audit</h1>
    ${html}
  </main>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  let body: { html?: string; css?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const html = (body.html ?? "").trim();
  const css  = (body.css  ?? "").trim() || undefined;

  if (!html) {
    return NextResponse.json({ error: "html is required." }, { status: 400 });
  }
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    return NextResponse.json(
      { error: "HTML payload exceeds 500 KB limit." },
      { status: 413 }
    );
  }

  const document = buildDocument(html, css);

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(document, { waitUntil: "domcontentloaded" });

    const results = await new AxeBuilder({ page })
      .withTags([
        "wcag2a", "wcag2aa",
        "wcag21a", "wcag21aa",
        "wcag22aa",
        "section508",
        "best-practice",
      ])
      .analyze();

    await browser.close();

    return NextResponse.json({
      mode: "html",
      timestamp: new Date().toISOString(),
      hasCss: !!css,
      violations:   results.violations,
      incomplete:   results.incomplete,
      passes:       results.passes,
      inapplicable: results.inapplicable.length,
      testEngine:   results.testEngine,
    });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Analysis failed: ${message}` },
      { status: 500 }
    );
  }
}
