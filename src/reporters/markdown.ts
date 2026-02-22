import type { ProbeSession, ProbeStats, ProbeResult } from "../core/types.js";
import { formatResponseTime, formatBytes } from "../core/analyzer.js";

// um markdown profissa pra dar ctrl c + ctrl v la no root do github
export function generateMarkdownReport(session: ProbeSession): string {
    const lines: string[] = [];
    const duration = session.endedAt
        ? Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
        : 0;

    // Header
    lines.push("# ⚡ httpulse Report");
    lines.push("");
    lines.push(`**Session ID:** \`${session.id}\``);
    lines.push(`**Started:** ${session.startedAt.toISOString()}`);
    lines.push(`**Ended:** ${session.endedAt?.toISOString() ?? "In progress"}`);
    lines.push(`**Duration:** ${duration}s`);
    lines.push(`**Total Probes:** ${session.results.length}`);
    lines.push("");

    // Summary table
    lines.push("## Summary");
    lines.push("");
    lines.push("| Target | Uptime | Avg | P95 | P99 | Probes |");
    lines.push("|--------|--------|-----|-----|-----|--------|");

    for (const [url, stats] of session.stats) {
        lines.push(
            `| ${url} | ${stats.uptimePercent}% | ${formatResponseTime(stats.avgResponseTime)} | ${formatResponseTime(stats.p95ResponseTime)} | ${formatResponseTime(stats.p99ResponseTime)} | ${stats.total} |`,
        );
    }

    lines.push("");

    // Per-target details
    for (const [url, stats] of session.stats) {
        lines.push(`## ${url}`);
        lines.push("");
        lines.push(renderStatsMarkdown(stats));
        lines.push("");

        // Recent results
        const targetResults = session.results.filter((r) => r.url === url);
        if (targetResults.length > 0) {
            lines.push("### Recent Probes");
            lines.push("");
            lines.push("| Time | Status | Code | Response Time | Size |");
            lines.push("|------|--------|------|---------------|------|");

            const recent = targetResults.slice(-20);
            for (const result of recent) {
                lines.push(renderResultRow(result));
            }
            lines.push("");
        }
    }

    // SSL details
    const sslResults = session.results.filter((r) => r.certificate !== null);
    if (sslResults.length > 0) {
        lines.push("## SSL Certificates");
        lines.push("");
        lines.push("| Target | Subject | Issuer | Expires | Valid |");
        lines.push("|--------|---------|--------|---------|-------|");

        const seen = new Set<string>();
        for (const result of sslResults) {
            if (seen.has(result.url) || !result.certificate) continue;
            seen.add(result.url);
            const cert = result.certificate;
            const expiryIcon = cert.daysUntilExpiry <= 7 ? "🔴" : cert.daysUntilExpiry <= 30 ? "🟡" : "🟢";
            lines.push(
                `| ${result.label} | ${cert.subject} | ${cert.issuer} | ${expiryIcon} ${cert.daysUntilExpiry}d | ${cert.isValid ? "✅" : "❌"} |`,
            );
        }
        lines.push("");
    }

    lines.push("---");
    lines.push("*Gerado por [httpulse](https://github.com/nesquiksuquinho/httpulse)*");

    return lines.join("\n");
}

function renderStatsMarkdown(stats: ProbeStats): string {
    const lines = [
        "| Metric | Value |",
        "|--------|-------|",
        `| Total Probes | ${stats.total} |`,
        `| Successful | ${stats.successful} |`,
        `| Failed | ${stats.failed} |`,
        `| Uptime | ${stats.uptimePercent}% |`,
        `| Avg Response | ${formatResponseTime(stats.avgResponseTime)} |`,
        `| Min Response | ${formatResponseTime(stats.minResponseTime)} |`,
        `| Max Response | ${formatResponseTime(stats.maxResponseTime)} |`,
        `| P50 | ${formatResponseTime(stats.p50ResponseTime)} |`,
        `| P95 | ${formatResponseTime(stats.p95ResponseTime)} |`,
        `| P99 | ${formatResponseTime(stats.p99ResponseTime)} |`,
    ];
    return lines.join("\n");
}

function renderResultRow(result: ProbeResult): string {
    const time = result.timestamp.toISOString().split("T")[1]?.split(".")[0] ?? "";
    const statusIcon = result.status === "up" ? "🟢" : result.status === "degraded" ? "🟡" : "🔴";
    const code = result.statusCode !== null ? String(result.statusCode) : "—";
    return `| ${time} | ${statusIcon} ${result.status} | ${code} | ${formatResponseTime(result.timings.total)} | ${formatBytes(result.responseSize)} |`;
}
