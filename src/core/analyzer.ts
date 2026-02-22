import type { ProbeResult, ProbeStats } from "./types.js";

const MAX_HISTORY_LENGTH = 200;

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] ?? 0;
}

// calcula as estatisticas (media, p95, uptime) pra gente exibir dps
export function computeStats(results: ProbeResult[]): ProbeStats {
    if (results.length === 0) {
        return {
            total: 0,
            successful: 0,
            failed: 0,
            uptimePercent: 0,
            avgResponseTime: 0,
            minResponseTime: 0,
            maxResponseTime: 0,
            p50ResponseTime: 0,
            p95ResponseTime: 0,
            p99ResponseTime: 0,
            responseTimeHistory: [],
        };
    }

    const successful = results.filter((r) => r.status === "up" || r.status === "degraded");
    const failed = results.filter((r) => r.status === "down" || r.status === "timeout" || r.status === "error");

    const responseTimes = results.map((r) => r.timings.total);
    const sorted = [...responseTimes].sort((a, b) => a - b);

    const sum = responseTimes.reduce((acc, t) => acc + t, 0);
    const avg = Math.round((sum / responseTimes.length) * 100) / 100;

    return {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
        uptimePercent: Math.round((successful.length / results.length) * 10000) / 100,
        avgResponseTime: avg,
        minResponseTime: sorted[0] ?? 0,
        maxResponseTime: sorted[sorted.length - 1] ?? 0,
        p50ResponseTime: percentile(sorted, 50),
        p95ResponseTime: percentile(sorted, 95),
        p99ResponseTime: percentile(sorted, 99),
        responseTimeHistory: responseTimes.slice(-MAX_HISTORY_LENGTH),
    };
}

// separa os resultados por url pra facilitar a vida
export function groupResultsByUrl(results: ProbeResult[]): Map<string, ProbeResult[]> {
    const groups = new Map<string, ProbeResult[]>();

    for (const result of results) {
        const existing = groups.get(result.url);
        if (existing) {
            existing.push(result);
        } else {
            groups.set(result.url, [result]);
        }
    }

    return groups;
}

// tira as metricas finais da sessao toda duma vez
export function computeSessionStats(results: ProbeResult[]): Map<string, ProbeStats> {
    const groups = groupResultsByUrl(results);
    const stats = new Map<string, ProbeStats>();

    for (const [url, groupResults] of groups) {
        stats.set(url, computeStats(groupResults));
    }

    return stats;
}

// verifica se deu uns picos bizarros de lentidao do nada
export function isAnomaly(result: ProbeResult, stats: ProbeStats): boolean {
    if (stats.total < 5) return false;

    // Considera anomalia se o tempo de resposta for mais que 2x o p95
    const threshold = stats.p95ResponseTime * 2;
    return result.timings.total > threshold;
}

// deixa o tempo milissegundos bonitinho pra ler
export function formatResponseTime(ms: number): string {
    if (ms < 1) return `${Math.round(ms * 1000)}µs`;
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}

// converte bytes pra kb, mb pra humano entender
export function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, exponent);
    const unit = units[exponent] ?? "B";
    return `${value.toFixed(exponent === 0 ? 0 : 1)} ${unit}`;
}
