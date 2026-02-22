import chalk from "chalk";
import type { ProbeTarget } from "../../core/types.js";
import { ProbeScheduler } from "../../core/scheduler.js";
import { renderCompactResult, renderBanner, renderSessionSummary } from "../ui/table.js";

// config de como o treco de ficar monitorando ao vivaco vai se comportar
export interface ProbeOptions {
    
    interval: string;
    
    duration: string;
    
    maxProbes: number;
    
    method: string;
    
    expectedStatus: number;
    
    timeout: number;
    
    dashboard: boolean;
    
    headers: string[];
}

function parseDuration(input: string): number {
    const match = input.match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h)$/i);
    if (!match) {
        throw new Error(`Invalid duration format: "${input}". Use 500ms, 5s, 2m, or 1h`);
    }

    const value = parseFloat(match[1]!);
    const unit = match[2]!.toLowerCase();

    switch (unit) {
        case "ms":
            return value;
        case "s":
            return value * 1000;
        case "m":
            return value * 60 * 1000;
        case "h":
            return value * 60 * 60 * 1000;
        default:
            throw new Error(`Unknown duration unit: ${unit}`);
    }
}

// comando q executa o barato do probe continuo na unha, conectando na interface ali
export async function probeCommand(urls: string[], options: ProbeOptions): Promise<void> {
    process.stdout.write(renderBanner());

    if (urls.length === 0) {
        console.error(chalk.red("  Erro: Pelo menos uma URL é necessária"));
        process.exit(1);
    }

    // Parse headers
    const headers: Record<string, string> = {};
    for (const header of options.headers) {
        const colonIndex = header.indexOf(":");
        if (colonIndex > 0) {
            const key = header.slice(0, colonIndex).trim();
            const value = header.slice(colonIndex + 1).trim();
            headers[key] = value;
        }
    }

    // Build targets
    const targets: ProbeTarget[] = urls.map((url) => ({
        url,
        method: options.method as ProbeTarget["method"],
        timeout: options.timeout,
        expectedStatus: options.expectedStatus,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
    }));

    const intervalMs = parseDuration(options.interval);
    const durationMs = options.duration === "0" ? 0 : parseDuration(options.duration);

    console.log(
        chalk.dim(
            `  Monitorando ${targets.length} alvo${targets.length > 1 ? "s" : ""} ` +
            `a cada ${options.interval}` +
            (durationMs > 0 ? ` por ${options.duration}` : "") +
            "\n",
        ),
    );

    const scheduler = new ProbeScheduler({
        targets,
        intervalMs,
        durationMs,
        maxProbes: options.maxProbes,
    });

    const allResults: Map<string, import("../../core/types.js").ProbeResult[]> = new Map();

    // Exibir resultados das sondas
    scheduler.on("probeComplete", (result) => {
        const urlResults = allResults.get(result.url) ?? [];
        urlResults.push(result);
        allResults.set(result.url, urlResults);
        console.log(renderCompactResult(result));
    });

    // Encerramento gracioso
    const handleShutdown = () => {
        scheduler.stop();
    };

    process.on("SIGINT", handleShutdown);
    process.on("SIGTERM", handleShutdown);

    // Handle session end
    scheduler.on("sessionEnd", (session) => {
        console.log(
            renderSessionSummary(
                session.stats,
                session.startedAt,
                session.endedAt ?? new Date(),
            ),
        );
    });

    // Start monitoring
    await scheduler.start();

    // Clean up signal handlers
    process.removeListener("SIGINT", handleShutdown);
    process.removeListener("SIGTERM", handleShutdown);
}
