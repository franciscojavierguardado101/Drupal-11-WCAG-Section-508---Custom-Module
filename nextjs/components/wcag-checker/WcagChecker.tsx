"use client";

import { useState } from "react";
import type { ScanMode, Impact, AuditResult, ScanResponse, WcagCheckerData } from "./types";

// ── Design tokens ────────────────────────────────────────────────────────────
const ACCENT  = "#8b5cf6";   // violet — distinct from NASA orange and DataGov cyan
const ACCENT2 = "rgba(139,92,246,0.12)";
const SURFACE = "#111";
const BORDER  = "rgba(255,255,255,0.08)";
const MUTED   = "rgba(255,255,255,0.35)";

const IMPACT_COLOR: Record<Impact, string> = {
  critical: "#ef4444",
  serious:  "#f97316",
  moderate: "#eab308",
  minor:    "#94a3b8",
};
const IMPACT_BG: Record<Impact, string> = {
  critical: "rgba(239,68,68,0.12)",
  serious:  "rgba(249,115,22,0.12)",
  moderate: "rgba(234,179,8,0.12)",
  minor:    "rgba(148,163,184,0.10)",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function impactOrder(i: Impact | null): number {
  return i === "critical" ? 0 : i === "serious" ? 1 : i === "moderate" ? 2 : 3;
}

function wcagId(tags: string[]): string {
  const m = tags.find((t) => /^wcag\d/.test(t));
  return m ? m.replace("wcag", "WCAG ").toUpperCase() : "";
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function downloadJson(results: ScanResponse) {
  const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `wcag-report-${Date.now()}.json`;
  a.click();
}

function downloadCsv(results: ScanResponse) {
  const rows = [
    ["Type", "Rule ID", "Impact", "WCAG Criteria", "Description", "Affected Elements", "Docs"],
    ...results.violations.map((v) => [
      "Violation",
      v.id,
      v.impact ?? "unknown",
      wcagId(v.tags),
      v.help,
      v.nodes.length.toString(),
      v.helpUrl,
    ]),
    ...results.incomplete.map((v) => [
      "Needs Manual Review",
      v.id,
      v.impact ?? "unknown",
      wcagId(v.tags),
      v.help,
      v.nodes.length.toString(),
      v.helpUrl,
    ]),
    ...results.passes.map((v) => [
      "Pass",
      v.id,
      "",
      wcagId(v.tags),
      v.help,
      v.nodes.length.toString(),
      v.helpUrl,
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `wcag-report-${Date.now()}.csv`;
  a.click();
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ImpactBadge({ impact }: { impact: Impact | null }) {
  if (!impact) return null;
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 3,
      fontSize: "0.7rem",
      fontWeight: 700,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      color: IMPACT_COLOR[impact],
      background: IMPACT_BG[impact],
      border: `1px solid ${IMPACT_COLOR[impact]}44`,
    }}>
      {impact}
    </span>
  );
}

function ViolationCard({ result, index }: { result: AuditResult; index: number }) {
  const [open, setOpen] = useState(false);
  const color = result.impact ? IMPACT_COLOR[result.impact] : MUTED;

  return (
    <div style={{
      borderLeft: `3px solid ${color}`,
      background: SURFACE,
      borderRadius: "0 6px 6px 0",
      marginBottom: 10,
      overflow: "hidden",
    }}>
      {/* Header row */}
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "12px 16px",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span style={{ color: MUTED, fontSize: "0.72rem", paddingTop: 2, minWidth: 20 }}>
          {String(index + 1).padStart(2, "0")}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
            <ImpactBadge impact={result.impact} />
            <code style={{ color: "#a78bfa", fontSize: "0.78rem", fontFamily: "monospace" }}>
              {result.id}
            </code>
            {wcagId(result.tags) && (
              <span style={{ fontSize: "0.7rem", color: MUTED, fontFamily: "monospace" }}>
                {wcagId(result.tags)}
              </span>
            )}
          </div>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "rgba(255,255,255,0.8)" }}>
            {result.help}
          </p>
          <p style={{ margin: "3px 0 0", fontSize: "0.75rem", color: MUTED }}>
            {result.nodes.length} affected {result.nodes.length === 1 ? "element" : "elements"}
            {" · "}
            <a
              href={result.helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ color: ACCENT, textDecoration: "none", borderBottom: `1px solid ${ACCENT}55` }}
            >
              WCAG docs ↗
            </a>
          </p>
        </div>
        <span style={{ color: MUTED, fontSize: "0.85rem", flexShrink: 0 }}>
          {open ? "▲" : "▼"}
        </span>
      </div>

      {/* Expanded nodes */}
      {open && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: "0 16px 12px 48px" }}>
          {result.nodes.map((node, ni) => {
            const selector = Array.isArray(node.target[0])
              ? (node.target as string[][]).map((t) => t.join(" > ")).join(", ")
              : (node.target as string[]).join(", ");
            return (
              <div key={ni} style={{ marginTop: 12 }}>
                <div style={{
                  fontSize: "0.7rem",
                  color: MUTED,
                  fontFamily: "monospace",
                  marginBottom: 4,
                  wordBreak: "break-all",
                }}>
                  {selector}
                </div>
                <pre style={{
                  margin: 0,
                  padding: "8px 12px",
                  background: "#0a0a0a",
                  border: `1px solid ${BORDER}`,
                  borderRadius: 4,
                  fontSize: "0.72rem",
                  color: "#e2e8f0",
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  fontFamily: "monospace",
                  maxHeight: 120,
                }}>
                  {node.html}
                </pre>
                {node.failureSummary && (
                  <p style={{
                    margin: "6px 0 0",
                    fontSize: "0.75rem",
                    color: "rgba(255,255,255,0.55)",
                    whiteSpace: "pre-line",
                  }}>
                    {node.failureSummary}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryBar({
  violations, incomplete, passes,
}: {
  violations: AuditResult[];
  incomplete: AuditResult[];
  passes: AuditResult[];
}) {
  const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const v of violations) {
    if (v.impact) counts[v.impact]++;
  }

  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: 10,
      padding: "16px 20px",
      background: "#0d0d0d",
      border: `1px solid ${BORDER}`,
      borderRadius: 6,
      marginBottom: 24,
    }}>
      {(["critical", "serious", "moderate", "minor"] as Impact[]).map((lvl) => (
        counts[lvl] > 0 && (
          <span key={lvl} style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "4px 12px",
            borderRadius: 4,
            background: IMPACT_BG[lvl],
            border: `1px solid ${IMPACT_COLOR[lvl]}44`,
            fontSize: "0.8rem",
            fontWeight: 600,
            color: IMPACT_COLOR[lvl],
          }}>
            {counts[lvl]} {lvl}
          </span>
        )
      ))}
      {incomplete.length > 0 && (
        <span style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "4px 12px", borderRadius: 4,
          background: "rgba(148,163,184,0.08)",
          border: "1px solid rgba(148,163,184,0.25)",
          fontSize: "0.8rem", fontWeight: 600,
          color: "#94a3b8",
        }}>
          {incomplete.length} need manual review
        </span>
      )}
      <span style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "4px 12px", borderRadius: 4,
        background: "rgba(34,197,94,0.08)",
        border: "1px solid rgba(34,197,94,0.25)",
        fontSize: "0.8rem", fontWeight: 600,
        color: "#22c55e",
      }}>
        {passes.length} passed
      </span>
    </div>
  );
}

function PassedRulesList({ passes }: { passes: AuditResult[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginBottom: 32 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          marginBottom: open ? 12 : 0,
        }}
      >
        <h4 style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.72rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "#22c55e",
          margin: 0,
        }}>
          Passed Rules ({passes.length})
        </h4>
        <span style={{ fontSize: "0.72rem", color: "#22c55e", opacity: 0.7 }}>
          {open ? "▲ hide" : "▼ show"}
        </span>
      </button>

      {open && (
        <div style={{
          background: SURFACE,
          border: "1px solid rgba(34,197,94,0.15)",
          borderRadius: 6,
          overflow: "hidden",
        }}>
          {passes.map((rule, i) => (
            <div
              key={rule.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                padding: "10px 16px",
                borderBottom: i < passes.length - 1 ? `1px solid ${BORDER}` : "none",
              }}
            >
              <span style={{ color: "#22c55e", fontSize: "0.85rem", flexShrink: 0, marginTop: 1 }}>✓</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 }}>
                  <code style={{ color: "#4ade80", fontSize: "0.75rem", fontFamily: "monospace" }}>
                    {rule.id}
                  </code>
                  {wcagId(rule.tags) && (
                    <span style={{ fontSize: "0.68rem", color: MUTED, fontFamily: "monospace" }}>
                      {wcagId(rule.tags)}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(255,255,255,0.6)" }}>
                  {rule.help}
                </p>
              </div>
              <a
                href={rule.helpUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: "0.68rem",
                  color: MUTED,
                  textDecoration: "none",
                  flexShrink: 0,
                  marginTop: 2,
                  opacity: 0.6,
                }}
                title="WCAG docs"
              >
                ↗
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function WcagChecker({ data }: { data: WcagCheckerData }) {
  const { heading } = data;

  const [mode, setMode]       = useState<ScanMode>("url");
  const [url, setUrl]         = useState("");
  const [html, setHtml]       = useState("");
  const [css, setCss]         = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ScanResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const sorted = results
    ? [...results.violations].sort(
        (a, b) => impactOrder(a.impact) - impactOrder(b.impact)
      )
    : [];

  async function runScan() {
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const endpoint = mode === "url" ? "/api/wcag-scan-url" : "/api/wcag-scan-html";
      const body     = mode === "url"
        ? { url }
        : { html, css: css || undefined };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data: ScanResponse = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResults(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    !loading && (mode === "url" ? url.trim().startsWith("http") : html.trim().length > 0);

  // ── Input styles ──────────────────────────────────────────────────────────
  const inputBase: React.CSSProperties = {
    width: "100%",
    background: "#0d0d0d",
    border: `1px solid ${BORDER}`,
    borderRadius: 5,
    color: "#fff",
    fontFamily: "var(--font-body, monospace)",
    fontSize: "0.85rem",
    padding: "10px 14px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s",
  };

  const btnPrimary: React.CSSProperties = {
    padding: "10px 28px",
    borderRadius: 5,
    border: "none",
    background: canSubmit ? ACCENT : "rgba(139,92,246,0.35)",
    color: canSubmit ? "#fff" : "rgba(255,255,255,0.4)",
    fontFamily: "var(--font-body)",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: canSubmit ? "pointer" : "not-allowed",
    transition: "all 0.15s",
    letterSpacing: "0.03em",
  };

  return (
    <section style={{ padding: "64px 0", background: "#0d0d0d" }}>
      <div className="page-width">

        {/* Heading */}
        {heading && (
          <h2 style={{
            fontFamily: "var(--font-header)",
            fontSize: "clamp(1.4rem, 3vw, 2rem)",
            letterSpacing: "0.04em",
            color: "#fff",
            marginBottom: 4,
            lineHeight: 1.2,
          }}>
            {heading}
          </h2>
        )}
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem", color: MUTED, margin: "0 0 28px" }}>
          Powered by Playwright + axe-core &nbsp;·&nbsp; WCAG 2.1 AA / Section 508
          &nbsp;·&nbsp; ~57% automated coverage
        </p>

        {/* Mode tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: `1px solid ${BORDER}` }}>
          {(["url", "html"] as ScanMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setResults(null); setError(null); }}
              style={{
                padding: "9px 22px",
                background: "transparent",
                border: "none",
                borderBottom: mode === m ? `2px solid ${ACCENT}` : "2px solid transparent",
                color: mode === m ? ACCENT : MUTED,
                fontFamily: "var(--font-body)",
                fontSize: "0.85rem",
                fontWeight: mode === m ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s",
                marginBottom: -1,
              }}
            >
              {m === "url" ? "URL Scanner" : "HTML Inspector"}
            </button>
          ))}
        </div>

        {/* Input panel */}
        <div style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          padding: "24px",
          marginBottom: 32,
        }}>
          {mode === "url" ? (
            <>
              <label style={{ display: "block", fontFamily: "var(--font-body)", fontSize: "0.78rem", color: MUTED, marginBottom: 8 }}>
                PUBLIC URL — paste any publicly accessible webpage
              </label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && canSubmit && runScan()}
                  placeholder="https://example.com/page"
                  style={{ ...inputBase, flex: 1, minWidth: 280 }}
                />
                <button onClick={runScan} disabled={!canSubmit} style={btnPrimary}>
                  {loading ? "Scanning…" : "Scan URL →"}
                </button>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "0.72rem", color: "rgba(255,255,255,0.22)" }}>
                Only http:// and https:// URLs. Localhost and private networks are blocked.
              </p>
            </>
          ) : (
            <>
              <label style={{ display: "block", fontFamily: "var(--font-body)", fontSize: "0.78rem", color: MUTED, marginBottom: 8 }}>
                HTML — paste from browser Inspect panel (right-click → Inspect, copy any element or the full &lt;body&gt;)
              </label>
              <textarea
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                placeholder={"<section>\n  <h1>Page Title</h1>\n  <img src=\"hero.jpg\" />\n</section>"}
                rows={8}
                style={{ ...inputBase, resize: "vertical", lineHeight: 1.5 }}
              />
              <label style={{ display: "block", fontFamily: "var(--font-body)", fontSize: "0.78rem", color: MUTED, margin: "16px 0 8px" }}>
                CSS (optional but recommended — enables color contrast checks)
              </label>
              <textarea
                value={css}
                onChange={(e) => setCss(e.target.value)}
                placeholder={"/* paste your stylesheet or relevant rules */\nbody { background: #fff; color: #111; }"}
                rows={4}
                style={{ ...inputBase, resize: "vertical", lineHeight: 1.5 }}
              />
              <p style={{ margin: "8px 0 12px", fontSize: "0.72rem", color: "rgba(255,255,255,0.22)" }}>
                Without CSS, color contrast checks are skipped. Fragments are automatically wrapped in a valid HTML document.
              </p>
              <button onClick={runScan} disabled={!canSubmit} style={btnPrimary}>
                {loading ? "Analyzing…" : "Analyze HTML →"}
              </button>
            </>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            gap: 12, padding: "40px 0",
            color: MUTED, fontFamily: "var(--font-body)", fontSize: "0.875rem",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              border: `3px solid ${BORDER}`,
              borderTopColor: ACCENT,
              animation: "spin 0.8s linear infinite",
            }} />
            <span>
              {mode === "url"
                ? "Playwright is loading the page and running axe-core — this takes 10–30 seconds…"
                : "Rendering HTML in Chromium and running axe-core…"}
            </span>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            padding: "14px 18px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 6,
            color: "#fca5a5",
            fontFamily: "var(--font-body)",
            fontSize: "0.85rem",
            marginBottom: 24,
          }}>
            {error}
          </div>
        )}

        {/* Results */}
        {results && !loading && (
          <div>
            {/* Results header */}
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 20,
            }}>
              <div>
                <h3 style={{
                  fontFamily: "var(--font-header, var(--font-body))",
                  fontSize: "1rem",
                  color: "#fff",
                  margin: "0 0 4px",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}>
                  Accessibility Audit Results
                </h3>
                <p style={{ margin: 0, fontSize: "0.75rem", color: MUTED, fontFamily: "var(--font-body)" }}>
                  {results.scannedUrl
                    ? <><span style={{ color: "rgba(255,255,255,0.6)" }}>{results.scannedUrl}</span> · </>
                    : null}
                  {formatTs(results.timestamp)}
                  {results.testEngine
                    ? ` · axe-core ${results.testEngine.version}`
                    : null}
                  {results.mode === "html" && !results.hasCss
                    ? " · no CSS — contrast checks skipped"
                    : null}
                </p>
              </div>
              {/* Download buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                {(["JSON", "CSV"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => fmt === "JSON" ? downloadJson(results) : downloadCsv(results)}
                    style={{
                      padding: "6px 16px",
                      borderRadius: 4,
                      border: `1px solid ${BORDER}`,
                      background: "transparent",
                      color: MUTED,
                      fontFamily: "var(--font-body)",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = ACCENT;
                      e.currentTarget.style.color = ACCENT;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = BORDER;
                      e.currentTarget.style.color = MUTED;
                    }}
                  >
                    ↓ {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary */}
            <SummaryBar
              violations={results.violations}
              incomplete={results.incomplete}
              passes={results.passes}
            />

            {/* Violations */}
            {sorted.length > 0 ? (
              <div style={{ marginBottom: 32 }}>
                <h4 style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.72rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: MUTED,
                  margin: "0 0 12px",
                }}>
                  Violations ({sorted.length})
                </h4>
                {sorted.map((v, i) => (
                  <ViolationCard key={v.id} result={v} index={i} />
                ))}
              </div>
            ) : (
              <div style={{
                padding: "20px 24px",
                background: "rgba(34,197,94,0.07)",
                border: "1px solid rgba(34,197,94,0.2)",
                borderRadius: 6,
                color: "#86efac",
                fontFamily: "var(--font-body)",
                fontSize: "0.875rem",
                marginBottom: 24,
              }}>
                No automated violations found.
              </div>
            )}

            {/* Passed rules */}
            {results.passes.length > 0 && (
              <PassedRulesList passes={results.passes} />
            )}

            {/* Incomplete / needs manual review */}
            {results.incomplete.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h4 style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.72rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: MUTED,
                  margin: "0 0 12px",
                }}>
                  Needs Manual Review ({results.incomplete.length})
                </h4>
                <p style={{ fontSize: "0.75rem", color: MUTED, margin: "0 0 12px", fontFamily: "var(--font-body)" }}>
                  axe-core could not automatically determine pass or fail for these rules. A human reviewer must verify them.
                </p>
                {results.incomplete.map((v, i) => (
                  <ViolationCard key={v.id} result={v} index={i} />
                ))}
              </div>
            )}

            {/* Disclaimer */}
            <div style={{
              padding: "14px 18px",
              background: ACCENT2,
              border: `1px solid ${ACCENT}33`,
              borderRadius: 6,
              fontFamily: "var(--font-body)",
              fontSize: "0.75rem",
              color: "rgba(255,255,255,0.45)",
              lineHeight: 1.6,
            }}>
              <strong style={{ color: "rgba(255,255,255,0.6)" }}>Coverage note:</strong>{" "}
              Automated tools including Playwright + axe-core detect approximately 57% of WCAG 2.1 AA criteria.
              Color contrast, meaningful alt text, logical reading order, focus management, and cognitive
              accessibility require human review alongside these results.
              This tool follows the same methodology as enterprise tools such as Deque axe DevTools and Siteimprove.
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
