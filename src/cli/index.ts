
import { Command } from "commander";
import { checkCommand } from "./commands/check.js";
import { probeCommand } from "./commands/probe.js";
import { reportCommand } from "./commands/report.js";
import { startInteractive } from "./commands/interactive.js";

const program = new Command();

program
    .name("httpulse")
    .description("⚡ Monitor de Saúde HTTP & Sonda de API — Monitore a saúde de suas APIs com visualizações em tempo real no terminal")
    .version("1.0.0");

// ─── comando check ──────────────────────────────────────────────────

program
    .command("check")
    .description("Realiza uma verificação de saúde única contra uma URL")
    .argument("<url>", "URL para verificar (deve incluir protocolo)")
    .option("-m, --method <method>", "Método HTTP a utilizar", "GET")
    .option("-t, --timeout <ms>", "Timeout da requisição em milissegundos", "10000")
    .option("-s, --expected-status <code>", "Código HTTP esperado", "200")
    .option("--ssl-details", "Exibir detalhes do certificado SSL", false)
    .option("--dns-details", "Exibir detalhes da resolução DNS", false)
    .option("-H, --header <header...>", "Headers customizados (chave:valor)", [])
    .option("--no-follow-redirects", "Não seguir redirecionamentos HTTP")
    .action(async (url: string, options: Record<string, unknown>) => {
        await checkCommand(url, {
            method: options.method as string,
            timeout: parseInt(options.timeout as string, 10),
            expectedStatus: parseInt(options.expectedStatus as string, 10),
            sslDetails: options.sslDetails as boolean,
            dnsDetails: options.dnsDetails as boolean,
            headers: (options.header ?? []) as string[],
            followRedirects: options.followRedirects as boolean,
        });
    });

// ─── comando probe ──────────────────────────────────────────────────

program
    .command("probe")
    .description("Monitora continuamente uma ou mais URLs")
    .argument("<urls...>", "URLs para monitorar (separadas por espaço)")
    .option("-i, --interval <duration>", "Intervalo entre sondas (ex: 5s, 1m)", "5s")
    .option("-d, --duration <duration>", "Duração máxima do monitoramento (ex: 5m, 1h). 0 para indefinido", "0")
    .option("-n, --max-probes <count>", "Número máximo de rodadas de sonda", "0")
    .option("-m, --method <method>", "Método HTTP a utilizar", "GET")
    .option("-s, --expected-status <code>", "Código HTTP esperado", "200")
    .option("-t, --timeout <ms>", "Timeout da requisição em milissegundos", "10000")
    .option("--dashboard", "Usar modo de dashboard interativo", false)
    .option("-H, --header <header...>", "Headers customizados (chave:valor)", [])
    .action(async (urls: string[], options: Record<string, unknown>) => {
        await probeCommand(urls, {
            interval: options.interval as string,
            duration: options.duration as string,
            maxProbes: parseInt(options.maxProbes as string, 10),
            method: options.method as string,
            expectedStatus: parseInt(options.expectedStatus as string, 10),
            timeout: parseInt(options.timeout as string, 10),
            dashboard: options.dashboard as boolean,
            headers: (options.header ?? []) as string[],
        });
    });

// ─── comando report ─────────────────────────────────────────────────

program
    .command("report")
    .description("Gera um relatório a partir de uma sessão de sonda salva")
    .requiredOption("-i, --input <file>", "Arquivo JSON de entrada com dados da sessão")
    .option("-f, --format <format>", "Formato de saída (json, markdown, html)", "markdown")
    .option("-o, --output <file>", "Caminho do arquivo de saída (stdout se não especificado)")
    .action(async (options: Record<string, unknown>) => {
        await reportCommand({
            input: options.input as string,
            format: options.format as "json" | "markdown" | "html",
            output: options.output as string | undefined,
        });
    });

// ─── Modo interativo (sem argumentos) ───────────────────────────────

// Se nenhum argumento foi passado, abrir modo interativo
if (process.argv.length <= 2) {
    startInteractive();
} else {
    program.parse();
}
