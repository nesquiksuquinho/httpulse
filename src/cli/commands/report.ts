import chalk from "chalk";
import { readFile, writeFile } from "node:fs/promises";
import type { ProbeSession, ReportFormat } from "../../core/types.js";
import { generateJsonReport } from "../../reporters/json.js";
import { generateMarkdownReport } from "../../reporters/markdown.js";
import { generateHtmlReport } from "../../reporters/html.js";
import { renderBanner } from "../ui/table.js";

// o que o cara q rodou o comando enviou pras args do relatorio
export interface ReportOptions {
    
    input: string;
    
    format: ReportFormat;
    
    output?: string;
}

// pega um json e cospe num file o relatorio parseadinho
export async function reportCommand(options: ReportOptions): Promise<void> {
    process.stdout.write(renderBanner());

    // Read input file
    let rawData: string;
    try {
        rawData = await readFile(options.input, "utf-8");
    } catch {
        console.error(chalk.red(`  Erro: Não foi possível ler o arquivo "${options.input}"`));
        process.exit(1);
    }

    // Parse session data
    let sessionData: Record<string, unknown>;
    try {
        sessionData = JSON.parse(rawData) as Record<string, unknown>;
    } catch {
        console.error(chalk.red("  Erro: JSON inválido no arquivo de entrada"));
        process.exit(1);
    }

    // Reconstruct session object
    const session = reconstructSession(sessionData);

    // Generate report
    let report: string;
    switch (options.format) {
        case "json":
            report = generateJsonReport(session);
            break;
        case "markdown":
            report = generateMarkdownReport(session);
            break;
        case "html":
            report = generateHtmlReport(session);
            break;
        default:
            console.error(chalk.red(`  Erro: Formato desconhecido "${options.format as string}"`));
            process.exit(1);
    }

    // Output report
    if (options.output) {
        await writeFile(options.output, report, "utf-8");
        console.log(chalk.green(`  ✓ Relatório salvo em ${options.output}`));
    } else {
        console.log(report);
    }
}

function reconstructSession(data: Record<string, unknown>): ProbeSession {
    const results = Array.isArray(data.results)
        ? data.results.map((r: Record<string, unknown>) => ({
            ...r,
            timestamp: new Date(r.timestamp as string),
            certificate: r.certificate
                ? {
                    ...(r.certificate as Record<string, unknown>),
                    validFrom: new Date((r.certificate as Record<string, unknown>).validFrom as string),
                    validTo: new Date((r.certificate as Record<string, unknown>).validTo as string),
                }
                : null,
        }))
        : [];

    const statsObj = (data.stats as Record<string, unknown>) ?? {};
    const stats = new Map(Object.entries(statsObj));

    return {
        id: data.id as string,
        startedAt: new Date(data.startedAt as string),
        endedAt: data.endedAt ? new Date(data.endedAt as string) : null,
        targets: (data.targets as ProbeSession["targets"]) ?? [],
        results: results as ProbeSession["results"],
        stats: stats as ProbeSession["stats"],
    };
}
