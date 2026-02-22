import type { ProbeSession } from "../core/types.js";
import { formatResponseTime, formatBytes } from "../core/analyzer.js";

// monta aquele relatoriao HTML bunitasso no final
export function generateHtmlReport(session: ProbeSession): string {
  const duration = session.endedAt
    ? Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
    : 0;

  const statsEntries = Array.from(session.stats.entries());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>httpulse Report — ${session.startedAt.toISOString().split("T")[0]}</title>
  <style>
    :root {
      --bg: #0f0f13;
      --surface: #1a1a24;
      --border: #2a2a3a;
      --text: #e4e4ef;
      --text-dim: #8888a4;
      --accent: #ff6b35;
      --green: #22c55e;
      --yellow: #eab308;
      --red: #ef4444;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 2rem;
    }

    header {
      text-align: center;
      padding: 2rem 0 3rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 2rem;
    }

    header h1 {
      font-size: 2rem;
      font-weight: 700;
      color: var(--accent);
    }

    header h1 span { font-size: 1.5rem; }

    .meta {
      display: flex;
      gap: 2rem;
      justify-content: center;
      margin-top: 1rem;
      color: var(--text-dim);
      font-size: 0.875rem;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .card h2 {
      font-size: 1.125rem;
      margin-bottom: 1rem;
      color: var(--accent);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem;
    }

    .stat {
      text-align: center;
      padding: 1rem;
      background: var(--bg);
      border-radius: 8px;
    }

    .stat .value {
      font-size: 1.5rem;
      font-weight: 700;
    }

    .stat .label {
      font-size: 0.75rem;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 0.25rem;
    }

    .green { color: var(--green); }
    .yellow { color: var(--yellow); }
    .red { color: var(--red); }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }

    th {
      text-align: left;
      padding: 0.75rem;
      border-bottom: 1px solid var(--border);
      color: var(--text-dim);
      font-weight: 500;
      text-transform: uppercase;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
    }

    td {
      padding: 0.75rem;
      border-bottom: 1px solid var(--border);
    }

    tr:last-child td { border-bottom: none; }

    .status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 500;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
    }

    .dot.up { background: var(--green); }
    .dot.degraded { background: var(--yellow); }
    .dot.down, .dot.error, .dot.timeout { background: var(--red); }

    footer {
      text-align: center;
      padding: 2rem 0;
      color: var(--text-dim);
      font-size: 0.8rem;
      border-top: 1px solid var(--border);
      margin-top: 2rem;
    }

    footer a {
      color: var(--accent);
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1><span>⚡</span> httpulse Report</h1>
      <div class="meta">
        <span>Session: ${session.id.slice(0, 8)}</span>
        <span>Duration: ${duration}s</span>
        <span>Probes: ${session.results.length}</span>
        <span>${session.startedAt.toISOString()}</span>
      </div>
    </header>

    ${statsEntries
      .map(
        ([url, stats]) => `
    <div class="card">
      <h2>${url}</h2>
      <div class="grid">
        <div class="stat">
          <div class="value ${stats.uptimePercent >= 99 ? "green" : stats.uptimePercent >= 95 ? "yellow" : "red"}">${stats.uptimePercent}%</div>
          <div class="label">Uptime</div>
        </div>
        <div class="stat">
          <div class="value">${formatResponseTime(stats.avgResponseTime)}</div>
          <div class="label">Avg Response</div>
        </div>
        <div class="stat">
          <div class="value">${formatResponseTime(stats.p95ResponseTime)}</div>
          <div class="label">P95</div>
        </div>
        <div class="stat">
          <div class="value">${formatResponseTime(stats.p99ResponseTime)}</div>
          <div class="label">P99</div>
        </div>
        <div class="stat">
          <div class="value green">${stats.successful}</div>
          <div class="label">Successful</div>
        </div>
        <div class="stat">
          <div class="value ${stats.failed > 0 ? "red" : "green"}">${stats.failed}</div>
          <div class="label">Failed</div>
        </div>
      </div>
    </div>`,
      )
      .join("\n")}

    <div class="card">
      <h2>Probe Results</h2>
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Target</th>
            <th>Status</th>
            <th>Code</th>
            <th>Response Time</th>
            <th>Size</th>
          </tr>
        </thead>
        <tbody>
          ${session.results
      .slice(-50)
      .reverse()
      .map(
        (r) => `
          <tr>
            <td>${r.timestamp.toISOString().split("T")[1]?.split(".")[0] ?? ""}</td>
            <td>${r.label}</td>
            <td><span class="status"><span class="dot ${r.status}"></span>${r.status}</span></td>
            <td>${r.statusCode ?? "—"}</td>
            <td>${formatResponseTime(r.timings.total)}</td>
            <td>${formatBytes(r.responseSize)}</td>
          </tr>`,
      )
      .join("\n")}
        </tbody>
      </table>
    </div>

    <footer>
      Gerado por <a href="https://github.com/nesquiksuquinho/httpulse">httpulse</a>
    </footer>
  </div>
</body>
</html>`;
}
