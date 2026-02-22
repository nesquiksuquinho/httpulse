import chalk from "chalk";
import Table from "cli-table3";
import type { ProbeResult, ProbeStats } from "../../core/types.js";
import { formatResponseTime, formatBytes } from "../../core/analyzer.js";

function colorStatus(status: string): string {
    switch (status) {
        case "up":
            return chalk.green.bold("● ATIVO");
        case "degraded":
            return chalk.yellow.bold("◐ DEGRADADO");
        case "down":
            return chalk.red.bold("○ FORA");
        case "timeout":
            return chalk.red("◌ TIMEOUT");
        case "error":
            return chalk.red("✕ ERRO");
        default:
            return chalk.gray(status);
    }
}

function colorResponseTime(ms: number): string {
    const formatted = formatResponseTime(ms);
    if (ms < 200) return chalk.green(formatted);
    if (ms < 500) return chalk.yellow(formatted);
    if (ms < 1000) return chalk.hex("#FF8800")(formatted);
    return chalk.red(formatted);
}

// joga a fita do resultado no console todo bonitin, bloco principal
export function renderProbeResult(result: ProbeResult): string {
    const table = new Table({
        chars: {
            top: "─",
            "top-mid": "┬",
            "top-left": "┌",
            "top-right": "┐",
            bottom: "─",
            "bottom-mid": "┴",
            "bottom-left": "└",
            "bottom-right": "┘",
            left: "│",
            "left-mid": "├",
            mid: "─",
            "mid-mid": "┼",
            right: "│",
            "right-mid": "┤",
            middle: "│",
        },
        style: { "padding-left": 1, "padding-right": 1 },
    });

    table.push(
        [chalk.bold("Alvo"), chalk.cyan(result.label)],
        [chalk.bold("URL"), result.url],
        [chalk.bold("Status"), colorStatus(result.status)],
        [chalk.bold("Código HTTP"), result.statusCode !== null ? String(result.statusCode) : chalk.gray("N/A")],
        [chalk.bold("Tempo de Resposta"), colorResponseTime(result.timings.total)],
        [chalk.bold("TTFB"), colorResponseTime(result.timings.ttfb)],
        [chalk.bold("DNS"), formatResponseTime(result.timings.dns)],
        [chalk.bold("Tamanho"), formatBytes(result.responseSize)],
    );

    if (result.error) {
        table.push([chalk.bold("Erro"), chalk.red(result.error)]);
    }

    if (result.certificate) {
        const cert = result.certificate;
        const expiryColor =
            cert.daysUntilExpiry <= 7
                ? chalk.red
                : cert.daysUntilExpiry <= 30
                    ? chalk.yellow
                    : chalk.green;

        table.push(
            [chalk.bold("SSL Sujeito"), cert.subject],
            [chalk.bold("SSL Emissor"), cert.issuer],
            [chalk.bold("SSL Expira"), expiryColor(`${cert.daysUntilExpiry} dias`)],
            [chalk.bold("Protocolo TLS"), cert.protocol],
            [chalk.bold("SSL Válido"), cert.isValid ? chalk.green("✓ Sim") : chalk.red("✕ Não")],
        );
    }

    if (result.dns && result.dns.addresses.length > 0) {
        table.push([chalk.bold("Endereços DNS"), result.dns.addresses.join(", ")]);
    }

    return table.toString();
}

// tabela ascii style com o sumo das metricas
export function renderStatsTable(url: string, stats: ProbeStats): string {
    const uptimeColor =
        stats.uptimePercent >= 99
            ? chalk.green
            : stats.uptimePercent >= 95
                ? chalk.yellow
                : chalk.red;

    const table = new Table({
        head: [
            chalk.bold("Métrica"),
            chalk.bold("Valor"),
        ],
        chars: {
            top: "─",
            "top-mid": "┬",
            "top-left": "┌",
            "top-right": "┐",
            bottom: "─",
            "bottom-mid": "┴",
            "bottom-left": "└",
            "bottom-right": "┘",
            left: "│",
            "left-mid": "├",
            mid: "─",
            "mid-mid": "┼",
            right: "│",
            "right-mid": "┤",
            middle: "│",
        },
        style: { "padding-left": 1, "padding-right": 1 },
    });

    table.push(
        ["Alvo", chalk.cyan(url)],
        ["Total de Sondas", String(stats.total)],
        ["Sucesso", chalk.green(String(stats.successful))],
        ["Falhas", stats.failed > 0 ? chalk.red(String(stats.failed)) : chalk.green("0")],
        ["Uptime", uptimeColor(`${stats.uptimePercent}%`)],
        ["Resposta Média", colorResponseTime(stats.avgResponseTime)],
        ["Resposta Mín.", colorResponseTime(stats.minResponseTime)],
        ["Resposta Máx.", colorResponseTime(stats.maxResponseTime)],
        ["P50", colorResponseTime(stats.p50ResponseTime)],
        ["P95", colorResponseTime(stats.p95ResponseTime)],
        ["P99", colorResponseTime(stats.p99ResponseTime)],
    );

    return table.toString();
}

// log mais compactor pra quando tem chovendo sondagem na tela
export function renderCompactResult(result: ProbeResult): string {
    const time = result.timestamp.toLocaleTimeString();
    const status = colorStatus(result.status);
    const responseTime = colorResponseTime(result.timings.total);
    const code = result.statusCode !== null ? chalk.dim(`[${result.statusCode}]`) : "";

    return `${chalk.dim(time)} ${status} ${chalk.cyan(result.label)} ${responseTime} ${code}`;
}

// desenha o banner responsa de entrada do app antes de trampar
export function renderBanner(): string {
    const lines = [
        "",
        chalk.hex("#FF6B35").bold("  ⚡ httpulse"),
        chalk.dim("  Monitor de Saúde HTTP & Sonda de API — por nesquiksuquinho"),
        "",
    ];
    return lines.join("\n");
}

// aquela tabela finalzona da sessao pra falar tchau pro terminal
export function renderSessionSummary(
    stats: Map<string, ProbeStats>,
    startedAt: Date,
    endedAt: Date,
): string {
    const duration = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
    const lines: string[] = [
        "",
        chalk.hex("#FF6B35").bold("━".repeat(50)),
        chalk.bold("  📊 Resumo da Sessão"),
        chalk.dim(`  Duração: ${duration}s`),
        chalk.hex("#FF6B35").bold("━".repeat(50)),
        "",
    ];

    for (const [url, stat] of stats) {
        lines.push(renderStatsTable(url, stat));
        lines.push("");
    }

    return lines.join("\n");
}
