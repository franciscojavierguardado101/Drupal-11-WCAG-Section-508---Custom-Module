/**
 * @file
 * WCAG / Section 508 accessibility checker — client-side scanner.
 *
 * Injects axe-core into a sandboxed srcdoc iframe, collects results via
 * postMessage, and renders them directly in the DOM.
 */
(function (Drupal, drupalSettings, once) {
  'use strict';

  const ACCENT      = '#8b5cf6';
  const GREEN       = '#22c55e';
  const MUTED       = 'rgba(255,255,255,0.38)';
  const SCAN_TAGS   = ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','section508','best-practice'];

  const IMPACT_COLOR = {
    critical: '#ef4444',
    serious:  '#f97316',
    moderate: '#eab308',
    minor:    '#94a3b8',
  };

  const IMPACT_ORDER = { critical: 0, serious: 1, moderate: 2, minor: 3 };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function wcagCriterion(tags) {
    const tag = tags.find(t => /^wcag\d/.test(t));
    return tag ? tag.replace('wcag', 'WCAG ').toUpperCase() : '';
  }

  function formatTs(iso) {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  // ── Iframe scanner ───────────────────────────────────────────────────────────

  function buildIframeDoc(html, css) {
    const axePath = drupalSettings.wcagChecker.axePath;
    const styleTag = css ? `<style>${css}</style>` : '';
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>WCAG Audit</title>
<style>
  .a11y-skip { position:absolute;left:-9999px; }
  .a11y-h1   { position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap; }
</style>
${styleTag}
</head>
<body>
<a class="a11y-skip" href="#a11y-main">Skip to content</a>
<main id="a11y-main">
<h1 class="a11y-h1">Audit Document</h1>
${html}
</main>
<script>
(function(){
  var s=document.createElement('script');
  s.src=${JSON.stringify(axePath)};
  s.onload=function(){
    axe.run({runOnly:{type:'tag',values:${JSON.stringify(SCAN_TAGS)}}})
      .then(function(r){ window.parent.postMessage({type:'wcag-results',results:r},'*'); })
      .catch(function(e){ window.parent.postMessage({type:'wcag-error',error:e.message},'*'); });
  };
  s.onerror=function(){ window.parent.postMessage({type:'wcag-error',error:'Failed to load axe-core.'},'*'); };
  document.head.appendChild(s);
})();
</script>
</body>
</html>`;
  }

  function runAxe(html, css) {
    return new Promise(function (resolve, reject) {
      var iframe = document.createElement('iframe');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1280px;height:800px;visibility:hidden;';

      var timer = setTimeout(function () {
        cleanup();
        reject(new Error('Scan timed out after 30 seconds.'));
      }, 30000);

      function onMessage(e) {
        if (!e.data || (e.data.type !== 'wcag-results' && e.data.type !== 'wcag-error')) return;
        cleanup();
        if (e.data.type === 'wcag-error') {
          reject(new Error(e.data.error));
        } else {
          resolve(e.data.results);
        }
      }

      function cleanup() {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
      }

      window.addEventListener('message', onMessage);
      iframe.srcdoc = buildIframeDoc(html, css);
      document.body.appendChild(iframe);
    });
  }

  // ── Results renderer ─────────────────────────────────────────────────────────

  function renderResults(results, meta) {
    var violations = results.violations
      .slice()
      .sort(function (a, b) {
        return (IMPACT_ORDER[a.impact] ?? 4) - (IMPACT_ORDER[b.impact] ?? 4);
      });
    var incomplete = results.incomplete;
    var passes     = results.passes;

    var counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
    violations.forEach(function (v) { if (v.impact) counts[v.impact]++; });

    var ts = formatTs(new Date().toISOString());
    var html = '<div class="wcag-results-inner">';

    // Header
    html += '<div class="wcag-results-header">';
    html += '<div>';
    html += '<h2 class="wcag-results-title">Accessibility Audit Results</h2>';
    html += '<p class="wcag-results-meta">';
    if (meta.url) html += '<span class="wcag-scanned-url">' + esc(meta.url) + '</span> · ';
    html += esc(ts);
    if (results.testEngine) html += ' · axe-core ' + esc(results.testEngine.version);
    if (meta.mode === 'html' && !meta.hasCss) html += ' · no CSS — contrast checks skipped';
    html += '</p></div>';
    html += '<div class="wcag-dl-btns">';
    html += '<button class="wcag-dl-btn js-wcag-dl" data-format="json">↓ JSON</button>';
    html += '<button class="wcag-dl-btn js-wcag-dl" data-format="csv">↓ CSV</button>';
    html += '</div></div>';

    // Summary bar
    html += '<div class="wcag-summary">';
    ['critical','serious','moderate','minor'].forEach(function (lvl) {
      if (counts[lvl] > 0) {
        html += '<span class="wcag-badge wcag-badge--' + lvl + '">' + counts[lvl] + ' ' + lvl + '</span>';
      }
    });
    if (incomplete.length > 0) {
      html += '<span class="wcag-badge wcag-badge--review">' + incomplete.length + ' need manual review</span>';
    }
    html += '<span class="wcag-badge wcag-badge--pass">' + passes.length + ' passed</span>';
    html += '</div>';

    // Violations
    if (violations.length > 0) {
      html += '<div class="wcag-section">';
      html += '<h3 class="wcag-section-label">Violations (' + violations.length + ')</h3>';
      violations.forEach(function (v, i) {
        var color = IMPACT_COLOR[v.impact] || MUTED;
        html += '<details class="wcag-card" style="border-left-color:' + color + '">';
        html += '<summary class="wcag-card-summary">';
        html += '<span class="wcag-idx">' + String(i + 1).padStart(2, '0') + '</span>';
        if (v.impact) {
          html += '<span class="wcag-impact wcag-impact--' + v.impact + '">' + v.impact + '</span>';
        }
        html += '<code class="wcag-rule-id">' + esc(v.id) + '</code>';
        var crit = wcagCriterion(v.tags);
        if (crit) html += '<span class="wcag-criterion">' + esc(crit) + '</span>';
        html += '<span class="wcag-help">' + esc(v.help) + '</span>';
        html += '<span class="wcag-node-count">' + v.nodes.length + ' ' + (v.nodes.length === 1 ? 'element' : 'elements') + '</span>';
        html += '<a class="wcag-docs-link" href="' + esc(v.helpUrl) + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">WCAG docs ↗</a>';
        html += '</summary>';
        html += '<div class="wcag-nodes">';
        v.nodes.forEach(function (node) {
          var selector = Array.isArray(node.target[0])
            ? node.target.map(function (t) { return t.join(' > '); }).join(', ')
            : node.target.join(', ');
          html += '<div class="wcag-node">';
          html += '<div class="wcag-selector">' + esc(selector) + '</div>';
          html += '<pre class="wcag-html">' + esc(node.html) + '</pre>';
          if (node.failureSummary) {
            html += '<p class="wcag-failure">' + esc(node.failureSummary) + '</p>';
          }
          html += '</div>';
        });
        html += '</div></details>';
      });
      html += '</div>';
    } else {
      html += '<div class="wcag-no-violations">No automated violations found.</div>';
    }

    // Passed rules (collapsible)
    if (passes.length > 0) {
      html += '<details class="wcag-passed-details">';
      html += '<summary class="wcag-passed-summary">Passed Rules (' + passes.length + ')</summary>';
      html += '<div class="wcag-passed-list">';
      passes.forEach(function (rule) {
        html += '<div class="wcag-passed-row">';
        html += '<span class="wcag-check">✓</span>';
        html += '<code class="wcag-rule-id wcag-rule-id--pass">' + esc(rule.id) + '</code>';
        var crit = wcagCriterion(rule.tags);
        if (crit) html += '<span class="wcag-criterion">' + esc(crit) + '</span>';
        html += '<span class="wcag-help wcag-help--muted">' + esc(rule.help) + '</span>';
        html += '<a class="wcag-docs-link" href="' + esc(rule.helpUrl) + '" target="_blank" rel="noopener noreferrer">↗</a>';
        html += '</div>';
      });
      html += '</div></details>';
    }

    // Incomplete / manual review
    if (incomplete.length > 0) {
      html += '<div class="wcag-section">';
      html += '<h3 class="wcag-section-label wcag-section-label--review">Needs Manual Review (' + incomplete.length + ')</h3>';
      html += '<p class="wcag-manual-note">axe-core could not automatically determine pass or fail for these rules. A human reviewer must verify them.</p>';
      incomplete.forEach(function (v, i) {
        html += '<details class="wcag-card wcag-card--review">';
        html += '<summary class="wcag-card-summary">';
        html += '<span class="wcag-idx">' + String(i + 1).padStart(2, '0') + '</span>';
        if (v.impact) {
          html += '<span class="wcag-impact wcag-impact--' + v.impact + '">' + v.impact + '</span>';
        }
        html += '<code class="wcag-rule-id">' + esc(v.id) + '</code>';
        var crit = wcagCriterion(v.tags);
        if (crit) html += '<span class="wcag-criterion">' + esc(crit) + '</span>';
        html += '<span class="wcag-help">' + esc(v.help) + '</span>';
        html += '<a class="wcag-docs-link" href="' + esc(v.helpUrl) + '" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">WCAG docs ↗</a>';
        html += '</summary>';
        html += '</details>';
      });
      html += '</div>';
    }

    // Coverage disclaimer
    html += '<div class="wcag-disclaimer">';
    html += '<strong>Coverage note:</strong> Automated tools including axe-core detect approximately 57% of WCAG 2.1 AA criteria. ';
    html += 'Color contrast, meaningful alt text, logical reading order, focus management, and cognitive accessibility require human review alongside these results. ';
    html += 'This tool follows the same methodology as enterprise tools such as Deque axe DevTools and Siteimprove.';
    html += '</div>';

    html += '</div>';
    return html;
  }

  // ── CSV / JSON download ──────────────────────────────────────────────────────

  function downloadJson(results, meta) {
    var data = Object.assign({ mode: meta.mode, scannedUrl: meta.url || null }, results);
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'wcag-report-' + Date.now() + '.json';
    a.click();
  }

  function downloadCsv(results) {
    var rows = [['Type','Rule ID','Impact','WCAG Criteria','Description','Affected Elements','Docs']];
    results.violations.forEach(function (v) {
      rows.push(['Violation', v.id, v.impact || '', wcagCriterion(v.tags), v.help, v.nodes.length, v.helpUrl]);
    });
    results.incomplete.forEach(function (v) {
      rows.push(['Needs Manual Review', v.id, v.impact || '', wcagCriterion(v.tags), v.help, v.nodes.length, v.helpUrl]);
    });
    results.passes.forEach(function (v) {
      rows.push(['Pass', v.id, '', wcagCriterion(v.tags), v.help, v.nodes.length, v.helpUrl]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'wcag-report-' + Date.now() + '.csv';
    a.click();
  }

  // ── Drupal behavior ──────────────────────────────────────────────────────────

  Drupal.behaviors.wcagChecker = {
    attach: function (context) {
      once('wcag-checker', '.wcag-checker-form', context).forEach(function (form) {
        var resultsEl = form.querySelector('#wcag-results');
        var lastResults = null;
        var lastMeta = {};

        // Tab switching
        form.querySelectorAll('.wcag-tab').forEach(function (tab) {
          tab.addEventListener('click', function () {
            form.querySelectorAll('.wcag-tab').forEach(function (t) {
              t.classList.remove('wcag-tab--active');
              t.setAttribute('aria-selected', 'false');
            });
            tab.classList.add('wcag-tab--active');
            tab.setAttribute('aria-selected', 'true');

            var mode = tab.dataset.mode;
            form.querySelectorAll('.wcag-panel').forEach(function (p) {
              p.classList.add('wcag-panel--hidden');
            });
            var panel = form.querySelector('#wcag-panel-' + mode);
            if (panel) panel.classList.remove('wcag-panel--hidden');
          });
        });

        // Submit buttons
        form.querySelectorAll('.js-wcag-submit').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.preventDefault();

            var mode = btn.dataset.mode;
            var urlVal  = (form.querySelector('#wcag-url-input')  || {}).value  || '';
            var htmlVal = (form.querySelector('#wcag-html-input') || {}).value  || '';
            var cssVal  = (form.querySelector('#wcag-css-input')  || {}).value  || '';

            if (mode === 'url'  && !urlVal.trim())  return;
            if (mode === 'html' && !htmlVal.trim()) return;

            lastMeta = { mode: mode, url: mode === 'url' ? urlVal.trim() : null, hasCss: !!cssVal.trim() };
            resultsEl.innerHTML = '<div class="wcag-scanning"><div class="wcag-spinner"></div><span>'
              + (mode === 'url'
                  ? 'Fetching page and scanning for accessibility issues…'
                  : 'Rendering HTML and scanning for accessibility issues…')
              + '</span></div>';

            function doScan(html, css) {
              runAxe(html, css).then(function (results) {
                lastResults = results;
                resultsEl.innerHTML = renderResults(results, lastMeta);

                // Wire download buttons
                resultsEl.querySelectorAll('.js-wcag-dl').forEach(function (dlBtn) {
                  dlBtn.addEventListener('click', function () {
                    if (dlBtn.dataset.format === 'json') downloadJson(lastResults, lastMeta);
                    else downloadCsv(lastResults);
                  });
                });
              }).catch(function (err) {
                resultsEl.innerHTML = '<div class="wcag-error">Scan failed: ' + esc(err.message) + '</div>';
              });
            }

            if (mode === 'url') {
              var xhr = new XMLHttpRequest();
              xhr.open('POST', drupalSettings.wcagChecker.proxyPath, true);
              xhr.setRequestHeader('Content-Type', 'application/json');
              xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
              xhr.onload = function () {
                var data;
                try { data = JSON.parse(xhr.responseText); } catch (e) { data = {}; }
                if (data.error) {
                  resultsEl.innerHTML = '<div class="wcag-error">' + esc(data.error) + '</div>';
                  return;
                }
                doScan(data.html || '', '');
              };
              xhr.onerror = function () {
                resultsEl.innerHTML = '<div class="wcag-error">Failed to fetch URL. Ensure it is publicly accessible.</div>';
              };
              xhr.send(JSON.stringify({ url: urlVal.trim() }));
            } else {
              doScan(htmlVal, cssVal);
            }
          });
        });
      });
    },
  };

})(Drupal, drupalSettings, once);
