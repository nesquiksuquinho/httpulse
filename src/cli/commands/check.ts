import chalk from "chalk";
import type { ProbeTarget } from "../../core/types.js";
import { probe } from "../../core/prober.js";
import { renderProbeResult, renderBanner } from "../ui/table.js";
import { sslProbe, evaluateCertHealth } from "../../probes/ssl.js";
import { dnsProbe } from "../../probes/dns.js";

// os paranaue q da pra passar via terminal no check
export interface CheckOptions {

    method: string;

    timeout: number;

    expectedStatus: number;

    sslDetails: boolean;

    dnsDetails: boolean;

    headers: string[];

    followRedirects: boolean;
}

// da 1 tiro na api e mostra a ficha completa na cara do cliao
export async function checkCommand(inputUrl: string, options: CheckOptions): Promise<void> {
    process.stdout.write(renderBanner());

    let url = inputUrl.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://${url}`;
    }

    // Hora de destrinchar os cabeçalhos que o usuario maluco mandou via CLI
    const headers: Record<string, string> = {};
    for (const header of options.headers) {
        const colonIndex = header.indexOf(":");
        if (colonIndex > 0) {
            const key = header.slice(0, colonIndex).trim();
            const value = header.slice(colonIndex + 1).trim();
            headers[key] = value;
        }
    }

    const target: ProbeTarget = {
        url,
        method: options.method as ProbeTarget["method"],
        timeout: options.timeout,
        expectedStatus: options.expectedStatus,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        followRedirects: options.followRedirects,
    };

    console.log(chalk.dim(`  Analisando ${url}...\n`));

    // Mete bala na requisição
    const result = await probe(target);

    // Cospe o resultado bonitinho na tela
    console.log(renderProbeResult(result));

    // Detalhes extras do cadeado SSL (se for HTTPS, obvio)
    if (options.sslDetails && url.startsWith("https://")) {
        console.log("");
        console.log(chalk.bold("  🔒 Detalhes do Certificado SSL"));
        console.log("");

        const parsedUrl = new URL(url);
        const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : 443;
        const cert = await sslProbe(parsedUrl.hostname, port);

        if (cert) {
            const health = evaluateCertHealth(cert);
            const healthIcon =
                health === "healthy" ? "🟢" : health === "warning" ? "🟡" : "🔴";

            console.log(`  ${chalk.bold("Subject:")}     ${cert.subject}`);
            console.log(`  ${chalk.bold("Issuer:")}      ${cert.issuer}`);
            console.log(`  ${chalk.bold("Valid From:")}   ${cert.validFrom.toISOString()}`);
            console.log(`  ${chalk.bold("Valid To:")}     ${cert.validTo.toISOString()}`);
            console.log(`  ${chalk.bold("Expires In:")}   ${healthIcon} ${cert.daysUntilExpiry} days`);
            console.log(`  ${chalk.bold("Protocol:")}     ${cert.protocol}`);
            console.log(`  ${chalk.bold("Valid:")}         ${cert.isValid ? chalk.green("✓") : chalk.red("✕")}`);
        } else {
            console.log(chalk.red("  Não foi possível obter o certificado SSL"));
        }
    }

    // Quer ver a capivara do DNS também? A gente mostra
    if (options.dnsDetails) {
        console.log("");
        console.log(chalk.bold("  🌐 Detalhes DNS"));
        console.log("");

        const parsedUrl = new URL(url);
        const dnsInfo = await dnsProbe(parsedUrl.hostname);

        console.log(`  ${chalk.bold("Resolve Time:")} ${dnsInfo.resolveTime}ms`);
        if (dnsInfo.ipv4.length > 0) {
            console.log(`  ${chalk.bold("IPv4 (A):")}     ${dnsInfo.ipv4.join(", ")}`);
        }
        if (dnsInfo.ipv6.length > 0) {
            console.log(`  ${chalk.bold("IPv6 (AAAA):")}  ${dnsInfo.ipv6.join(", ")}`);
        }
        if (dnsInfo.mx.length > 0) {
            console.log(`  ${chalk.bold("MX Records:")}   ${dnsInfo.mx.map((r) => `${r.exchange} (${r.priority})`).join(", ")}`);
        }
        if (dnsInfo.ns.length > 0) {
            console.log(`  ${chalk.bold("NS Records:")}   ${dnsInfo.ns.join(", ")}`);
        }
    }

    console.log("");

    // Devolve o codigo pro sistema operacional (0 deu bom, 1 deu ruim)
    process.exit(result.status === "up" ? 0 : 1);
}
