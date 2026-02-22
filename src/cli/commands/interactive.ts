import chalk from "chalk";
import { createInterface } from "node:readline";
import { probe } from "../../core/prober.js";
import { ProbeScheduler } from "../../core/scheduler.js";
import { computeStats } from "../../core/analyzer.js";
import { sslProbe, evaluateCertHealth } from "../../probes/ssl.js";
import { dnsProbe } from "../../probes/dns.js";
import { tcpProbe } from "../../probes/tcp.js";
import { formatResponseTime, formatBytes } from "../../core/analyzer.js";
import { sparkline } from "../ui/sparkline.js";
import { request } from "undici";

// cores do tema pra deixar bonitão
const ACCENT = "#FF6B35";
const ACCENT2 = "#00D4AA";
const DIM_LINE = chalk.hex("#444444");
const LINE_CHAR = "─";

// subdomínios mais comuns pra gente tentar achar
const SUBDOMAIN_PREFIXES = [
    "www", "mail", "ftp", "smtp", "pop", "imap", "webmail",
    "api", "dev", "staging", "beta", "test", "app",
    "admin", "panel", "dashboard", "portal",
    "cdn", "static", "assets", "media", "img", "images",
    "shop", "store", "blog", "forum", "wiki", "docs",
    "ns1", "ns2", "dns", "dns1", "dns2",
    "mx", "mx1", "mx2", "email",
    "vpn", "remote", "gateway", "proxy",
    "db", "database", "sql", "mysql", "mongo", "redis",
    "git", "gitlab", "ci", "jenkins", "deploy",
    "status", "monitor", "health", "metrics",
    "auth", "login", "sso", "oauth",
    "ws", "socket", "realtime", "live",
    "m", "mobile", "web",
    "s3", "storage", "backup",
    "support", "help", "chat",
];

// desenha uma linha separadora bonitinha no terminal
function line(width = 60): string {
    return DIM_LINE(LINE_CHAR.repeat(width));
}

// se a galera esquecer o http://, a gente bota sozinho
function normalizeUrl(input: string): string {
    let url = input.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://${url}`;
    }
    return url;
}

// pega só o domínio (ex: https://api.github.com/v3 -> api.github.com)
function extractHostname(input: string): string {
    try {
        const url = new URL(normalizeUrl(input));
        return url.hostname;
    } catch {
        return input.trim();
    }
}

// tela inicial quando abre o httpulse
function renderWelcome(): void {
    console.clear();

    const logo = [
        "",
        chalk.hex(ACCENT).bold("   ██╗  ██╗████████╗████████╗██████╗ ██╗   ██╗██╗     ███████╗███████╗"),
        chalk.hex(ACCENT).bold("   ██║  ██║╚══██╔══╝╚══██╔══╝██╔══██╗██║   ██║██║     ██╔════╝██╔════╝"),
        chalk.hex(ACCENT).bold("   ███████║   ██║      ██║   ██████╔╝██║   ██║██║     ███████╗█████╗  "),
        chalk.hex(ACCENT).bold("   ██╔══██║   ██║      ██║   ██╔═══╝ ██║   ██║██║     ╚════██║██╔══╝  "),
        chalk.hex(ACCENT).bold("   ██║  ██║   ██║      ██║   ██║     ╚██████╔╝███████╗███████║███████╗"),
        chalk.hex(ACCENT).bold("   ╚═╝  ╚═╝   ╚═╝      ╚═╝   ╚═╝      ╚═════╝ ╚══════╝╚══════╝╚══════╝"),
        "",
        `   ${chalk.hex(ACCENT2).bold("⚡")} ${chalk.bold("Monitor de Saúde HTTP & Sonda de API")}`,
        `   ${chalk.dim("Feito por")} ${chalk.hex(ACCENT2).bold("nesquiksuquinho")}`,
        "",
        line(72),
        "",
        `   ${chalk.hex(ACCENT2)("›")} Digite uma ${chalk.bold("URL")} para verificar    ${chalk.dim("ex: api.github.com")}`,
        `   ${chalk.hex(ACCENT2)("›")} ${chalk.bold("probe")} <url>                       ${chalk.dim("monitorar continuamente")}`,
        `   ${chalk.hex(ACCENT2)("›")} ${chalk.bold("comparar")} <url1> <url2> ...        ${chalk.dim("comparar latência lado a lado")}`,
        `   ${chalk.hex(ACCENT2)("›")} ${chalk.bold("ping")} <url> [n]                    ${chalk.dim("ping rápido (n vezes)")}`,
        `   ${chalk.hex(ACCENT2)("›")} ${chalk.bold("geo")} <ip ou host>                  ${chalk.dim("localização e dados do IP")}`,
        `   ${chalk.hex(ACCENT2)("›")} ${chalk.bold("tech")} <url>                      ${chalk.dim("detectar stack / tecnologias")}`,
        `   ${chalk.hex(ACCENT2)("›")} ${chalk.bold("paths")} <url>                     ${chalk.dim("descobrir caminhos/links")}`,
        `   ${chalk.hex(ACCENT2)("›")} ${chalk.bold("headers")} / ${chalk.bold("redirects")} / ${chalk.bold("portas")}       ${chalk.dim("análise de tráfego e rede")}`,
        `   ${chalk.hex(ACCENT2)("›")} ${chalk.bold("ssl")} / ${chalk.bold("dns")} / ${chalk.bold("tcp")} / ${chalk.bold("subdominios")}     ${chalk.dim("análise avançada de infra")}`,
        `   ${chalk.hex(ACCENT2)("›")} ${chalk.bold("ajuda")} para todos os comandos      ${chalk.dim("sair para encerrar")}`,
        "",
        line(72),
        "",
    ];

    console.log(logo.join("\n"));
}

function renderHelp(): void {
    const help = [
        "",
        `   ${chalk.hex(ACCENT).bold("📖 Comandos Disponíveis")}`,
        "",
        `   ${chalk.hex(ACCENT2).bold("Sondagem HTTP:")}`,
        `   ${chalk.bold("<url>")}                     Verifica saúde de um endpoint`,
        `                             ${chalk.dim("Ex: api.github.com  ou  https://google.com")}`,
        `   ${chalk.bold("check <url>")}              Mesmo que digitar a URL diretamente`,
        "",
        `   ${chalk.hex(ACCENT2).bold("Monitoramento:")}`,
        `   ${chalk.bold("probe <url>")}              Monitora continuamente (Ctrl+C para parar)`,
        `   ${chalk.bold("probe <url> <intervalo>")} Define intervalo (ex: probe google.com 3s)`,
        "",
        `   ${chalk.hex(ACCENT2).bold("Rede & Performance:")}`,
        `   ${chalk.bold("comparar <url1> <url2>")}  Compara latência de múltiplas URLs`,
        `   ${chalk.bold("ping <url> [n]")}           Ping rápido (n vezes, padrão: 5)`,
        `   ${chalk.bold("geo <host|ip>")}            Descobre país, cidade e provedor do IP`,
        `   ${chalk.bold("tech <url>")}               Detecta frameworks, CMS e servidores web`,
        `   ${chalk.bold("paths <url>")}              Vasculha a página e lista todos os links/caminhos`,
        `   ${chalk.bold("redirects <url>")}          Segue a cadeia completa de redirects`,
        `   ${chalk.bold("headers <url>")}            Exibe headers HTTP e verifica segurança`,
        "",
        `   ${chalk.hex(ACCENT2).bold("Infraestrutura:")}`,
        `   ${chalk.bold("portas <host>")}            Escaneia portas comuns (HTTP, SSH, DB...)`,
        `   ${chalk.bold("subdominios <host>")}       Descobre subdomínios ativos usando DNS`,
        `   ${chalk.bold("ssl <host>")}               Inspeciona certificado SSL/TLS`,
        `   ${chalk.bold("dns <host>")}               Consulta registros DNS (A, AAAA, MX, NS)`,
        `   ${chalk.bold("tcp <host> <porta>")}       Verifica se uma porta TCP está aberta`,
        "",
        `   ${chalk.hex(ACCENT2).bold("Outros:")}`,
        `   ${chalk.bold("limpar")} / ${chalk.bold("voltar")}         Limpa a tela e volta ao menu inicial`,
        `   ${chalk.bold("ajuda")}                    Mostra esta mensagem`,
        `   ${chalk.bold("sair")}                     Encerra o httpulse`,
        "",
        line(72),
        "",
    ];
    console.log(help.join("\n"));
}

function statusBadge(status: string): string {
    switch (status) {
        case "up": return chalk.bgGreen.black.bold(" ATIVO ");
        case "degraded": return chalk.bgYellow.black.bold(" DEGRADADO ");
        case "down": return chalk.bgRed.white.bold(" FORA ");
        case "timeout": return chalk.bgRed.white.bold(" TIMEOUT ");
        case "error": return chalk.bgRed.white.bold(" ERRO ");
        default: return chalk.bgGray.white.bold(` ${status.toUpperCase()} `);
    }
}

function colorTime(ms: number): string {
    const formatted = formatResponseTime(ms);
    if (ms < 200) return chalk.green.bold(formatted);
    if (ms < 500) return chalk.yellow.bold(formatted);
    if (ms < 1000) return chalk.hex("#FF8800").bold(formatted);
    return chalk.red.bold(formatted);
}

// ─── Verificação HTTP ───────────────────────────────────────────────

async function handleUrlCheck(input: string): Promise<void> {
    const url = normalizeUrl(input);

    console.log("");
    console.log(`   ${chalk.dim("⏳ Sondando")} ${chalk.cyan.bold(url)}${chalk.dim("...")}`);
    console.log("");

    try {
        const result = await probe({ url });

        console.log(`   ${statusBadge(result.status)} ${chalk.bold(result.label)}`);
        console.log("");

        const maxBar = 40;
        const barFill = Math.min(Math.round((result.timings.total / 2000) * maxBar), maxBar);
        const barEmpty = maxBar - barFill;
        const barColor = result.timings.total < 200 ? chalk.green : result.timings.total < 500 ? chalk.yellow : chalk.red;
        const bar = barColor("█".repeat(barFill)) + chalk.hex("#333333")("░".repeat(barEmpty));
        console.log(`   ${chalk.dim("Latência")} ${bar} ${colorTime(result.timings.total)}`);
        console.log("");

        const metrics: Array<[string, string]> = [
            ["Código HTTP", result.statusCode !== null ? chalk.bold(String(result.statusCode)) : chalk.dim("N/A")],
            ["Tempo Total", colorTime(result.timings.total)],
            ["TTFB", colorTime(result.timings.ttfb)],
            ["DNS", formatResponseTime(result.timings.dns)],
            ["Tamanho", formatBytes(result.responseSize)],
        ];
        for (const [label, value] of metrics) {
            console.log(`   ${chalk.dim("│")} ${chalk.dim(label.padEnd(14))} ${value}`);
        }

        if (result.timings.total > 0) {
            console.log("");
            console.log(`   ${chalk.dim("Detalhamento de Tempos:")}`);
            const phases = [
                { name: "DNS", time: result.timings.dns, color: chalk.blue },
                { name: "TCP", time: result.timings.tcp, color: chalk.cyan },
                { name: "TLS", time: result.timings.tls, color: chalk.magenta },
                { name: "TTFB", time: result.timings.ttfb, color: chalk.yellow },
            ];
            for (const phase of phases) {
                if (phase.time > 0) {
                    const phaseFill = Math.min(Math.round((phase.time / result.timings.total) * 30), 30);
                    console.log(`   ${chalk.dim("│")} ${phase.color(phase.name.padEnd(6))} ${phase.color("▓".repeat(phaseFill))} ${formatResponseTime(phase.time)}`);
                }
            }
        }

        if (result.certificate) {
            console.log("");
            console.log(`   ${chalk.dim("🔒 Certificado SSL:")}`);
            const cert = result.certificate;
            const hc = cert.daysUntilExpiry > 30 ? chalk.green : cert.daysUntilExpiry > 7 ? chalk.yellow : chalk.red;
            console.log(`   ${chalk.dim("│")} ${chalk.dim("Emissor".padEnd(14))} ${cert.issuer}`);
            console.log(`   ${chalk.dim("│")} ${chalk.dim("Protocolo".padEnd(14))} ${cert.protocol}`);
            console.log(`   ${chalk.dim("│")} ${chalk.dim("Expira em".padEnd(14))} ${hc(`${cert.daysUntilExpiry} dias`)}`);
            console.log(`   ${chalk.dim("│")} ${chalk.dim("Válido".padEnd(14))} ${cert.isValid ? chalk.green("✓ Sim") : chalk.red("✕ Não")}`);
        }

        if (result.dns && result.dns.addresses.length > 0) {
            console.log("");
            console.log(`   ${chalk.dim("🌐 DNS:")}`);
            console.log(`   ${chalk.dim("│")} ${chalk.dim("Endereços".padEnd(14))} ${result.dns.addresses.join(", ")}`);
        }

        if (result.error) {
            console.log("");
            console.log(`   ${chalk.red.bold("⚠ Erro:")} ${chalk.red(result.error)}`);
        }

        console.log("");
        console.log(line(72));
        console.log("");
    } catch (err) {
        console.log(`   ${chalk.red.bold("✕")} ${chalk.red("Falha ao sondar:")} ${err instanceof Error ? err.message : String(err)}`);
        console.log("");
    }
}

// ─── Headers HTTP ───────────────────────────────────────────────────

async function handleHeaders(input: string): Promise<void> {
    const url = normalizeUrl(input);

    console.log("");
    console.log(`   ${chalk.dim("📋 Obtendo headers de")} ${chalk.cyan.bold(url)}${chalk.dim("...")}`);
    console.log("");

    try {
        const response = await request(url, { method: "GET", signal: AbortSignal.timeout(10000) });
        await response.body.arrayBuffer();

        console.log(`   ${chalk.hex(ACCENT2).bold("HEADERS")} ${chalk.dim("HTTP")} ${chalk.bold(String(response.statusCode))}`);
        console.log("");

        const securityHeaders = ["strict-transport-security", "content-security-policy", "x-frame-options", "x-content-type-options", "x-xss-protection", "referrer-policy"];
        const cacheHeaders = ["cache-control", "etag", "last-modified", "expires", "age", "vary"];

        for (const [key, value] of Object.entries(response.headers)) {
            const val = Array.isArray(value) ? value.join(", ") : String(value ?? "");
            let color = chalk.white;
            if (securityHeaders.includes(key.toLowerCase())) color = chalk.green;
            else if (cacheHeaders.includes(key.toLowerCase())) color = chalk.cyan;
            else if (key.toLowerCase().startsWith("x-")) color = chalk.hex(ACCENT);

            const truncatedVal = val.length > 55 ? val.substring(0, 52) + "..." : val;
            console.log(`   ${chalk.dim("│")} ${color.bold(key.padEnd(28))} ${chalk.dim(truncatedVal)}`);
        }

        console.log("");
        console.log(`   ${chalk.dim("🛡️ Segurança:")}`);
        const hdrs = Object.keys(response.headers).map(k => k.toLowerCase());
        const checks = [
            ["HSTS", hdrs.includes("strict-transport-security")],
            ["CSP", hdrs.includes("content-security-policy")],
            ["X-Frame-Options", hdrs.includes("x-frame-options")],
            ["X-Content-Type", hdrs.includes("x-content-type-options")],
        ] as const;

        for (const [name, present] of checks) {
            console.log(`   ${chalk.dim("│")} ${name.padEnd(18)} ${present ? chalk.green.bold("✓ presente") : chalk.red("✕ ausente")}`);
        }

        console.log("");
        console.log(line(72));
        console.log("");
    } catch (err) {
        console.log(`   ${chalk.red.bold("✕")} ${chalk.red(String(err))}`);
        console.log("");
    }
}

// ─── Geo IP (Localização) ───────────────────────────────────────────

async function handleGeoIp(input: string): Promise<void> {
    const hostname = extractHostname(input);

    console.log("");
    console.log(`   ${chalk.hex(ACCENT2).bold("🌍")} ${chalk.bold("Buscando localização de")} ${chalk.cyan.bold(hostname)}${chalk.dim("...")}`);
    console.log("");

    try {
        // usando a api gratuita do ip-api pra pegar as infos (nao precisa de key)
        const response = await request(`http://ip-api.com/json/${hostname}`, {
            method: "GET",
            signal: AbortSignal.timeout(10000),
        });

        const data = await response.body.json() as any;

        if (data.status !== "success") {
            console.log(`   ${chalk.red.bold("✕")} Não foi possível localizar: ${data.message || 'IP inválido ou privado'}`);
            console.log("");
            return;
        }

        console.log(`   ${chalk.bgBlue.white.bold(` ${data.countryCode} `)} ${chalk.bold(data.query)}`);
        console.log("");

        console.log(`   ${chalk.dim("│")} ${chalk.dim("País".padEnd(14))} ${data.country}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Região".padEnd(14))} ${data.regionName} (${data.region})`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Cidade".padEnd(14))} ${data.city}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("CEP".padEnd(14))} ${data.zip || "N/A"}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Timezone".padEnd(14))} ${data.timezone}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("ISP".padEnd(14))} ${data.isp}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("ORG".padEnd(14))} ${data.org}`);

        // link pro google maps (bônus daora)
        const mapsLink = `https://www.google.com/maps?q=${data.lat},${data.lon}`;
        console.log("");
        console.log(`   ${chalk.dim("📍")} ${chalk.blue.underline(mapsLink)}`);

        console.log("");
        console.log(line(72));
        console.log("");

    } catch (err) {
        console.log(`   ${chalk.red.bold("✕")} ${chalk.red(String(err))}`);
        console.log("");
    }
}

// ─── Comparação de URLs ─────────────────────────────────────────────

async function handleCompare(urls: string[]): Promise<void> {
    const normalized = urls.map(normalizeUrl);

    console.log("");
    console.log(`   ${chalk.hex(ACCENT2).bold("⚖️")} ${chalk.bold(`Comparando ${normalized.length} endpoints...`)}`);
    console.log("");

    const results = await Promise.allSettled(normalized.map((url) => probe({ url })));

    let maxTime = 0;
    const items: Array<{ url: string; time: number; status: string; code: number | null; err: string | null }> = [];

    for (let i = 0; i < results.length; i++) {
        const r = results[i]!;
        if (r.status === "fulfilled") {
            items.push({ url: normalized[i]!, time: r.value.timings.total, status: r.value.status, code: r.value.statusCode, err: null });
            maxTime = Math.max(maxTime, r.value.timings.total);
        } else {
            items.push({ url: normalized[i]!, time: 0, status: "error", code: null, err: r.reason?.message ?? "Falha" });
        }
    }

    items.sort((a, b) => a.time - b.time);

    for (let i = 0; i < items.length; i++) {
        const r = items[i]!;
        const medal = i === 0 ? chalk.hex("#FFD700")("🥇") : i === 1 ? chalk.hex("#C0C0C0")("🥈") : i === 2 ? chalk.hex("#CD7F32")("🥉") : chalk.dim("  ");

        if (r.err) {
            console.log(`   ${medal} ${chalk.red.bold(extractHostname(r.url).padEnd(25))} ${chalk.red("ERRO")}`);
        } else {
            const fill = maxTime > 0 ? Math.max(1, Math.round((r.time / maxTime) * 35)) : 1;
            const empty = 35 - fill;
            const barColor = r.time < 200 ? chalk.green : r.time < 500 ? chalk.yellow : chalk.red;
            const badge = r.status === "up" ? chalk.green("●") : chalk.red("○");
            console.log(`   ${medal} ${badge} ${chalk.bold(extractHostname(r.url).padEnd(22))} ${barColor("█".repeat(fill))}${chalk.hex("#333333")("░".repeat(empty))} ${colorTime(r.time)} ${chalk.dim(`HTTP ${r.code}`)}`);
        }
    }

    const valid = items.filter((r) => !r.err);
    if (valid.length > 1) {
        const fastest = valid[0]!;
        const slowest = valid[valid.length - 1]!;
        const avg = Math.round(valid.reduce((s, r) => s + r.time, 0) / valid.length);

        console.log("");
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Mais rápido".padEnd(14))} ${chalk.green.bold(extractHostname(fastest.url))} ${chalk.dim(`(${formatResponseTime(fastest.time)})`)}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Mais lento".padEnd(14))} ${chalk.red.bold(extractHostname(slowest.url))} ${chalk.dim(`(${formatResponseTime(slowest.time)})`)}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Média".padEnd(14))} ${formatResponseTime(avg)}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Diferença".padEnd(14))} ${formatResponseTime(slowest.time - fastest.time)}`);
    }

    console.log("");
    console.log(line(72));
    console.log("");
}

// ─── Ping Rápido ────────────────────────────────────────────────────

async function handlePing(input: string, count: number): Promise<void> {
    const url = normalizeUrl(input);
    const hostname = extractHostname(input);

    console.log("");
    console.log(`   ${chalk.hex(ACCENT2).bold("📡")} ${chalk.bold("PING")} ${chalk.cyan.bold(hostname)} ${chalk.dim(`(${count} sondas)`)}`);
    console.log("");

    const times: number[] = [];

    for (let i = 0; i < count; i++) {
        try {
            const result = await probe({ url });
            times.push(result.timings.total);

            const seq = String(i + 1).padStart(2);
            const badge = result.status === "up" ? chalk.green("●") : chalk.red("○");
            const barFill = Math.min(Math.round((result.timings.total / 1000) * 20), 20);
            console.log(`   ${badge} ${chalk.dim(`#${seq}`)} ${chalk.hex(ACCENT)("▓".repeat(barFill))} ${colorTime(result.timings.total)} ${chalk.dim(`HTTP ${result.statusCode ?? "ERR"}`)} ${chalk.dim(formatBytes(result.responseSize))}`);
        } catch {
            console.log(`   ${chalk.red("○")} ${chalk.dim(`#${String(i + 1).padStart(2)}`)} ${chalk.red("timeout")}`);
        }
    }

    if (times.length > 0) {
        const min = Math.min(...times);
        const max = Math.max(...times);
        const avg = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
        const jitter = times.length > 1
            ? Math.round(times.reduce((sum, t, i) => i === 0 ? 0 : sum + Math.abs(t - times[i - 1]!), 0) / (times.length - 1))
            : 0;
        const spark = sparkline(times, 40);

        console.log("");
        console.log(`   ${chalk.dim("Estatísticas de")} ${chalk.bold(hostname)}${chalk.dim(":")}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Mín".padEnd(10))} ${chalk.green.bold(formatResponseTime(min))}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Média".padEnd(10))} ${colorTime(avg)}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Máx".padEnd(10))} ${chalk.red.bold(formatResponseTime(max))}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Jitter".padEnd(10))} ${formatResponseTime(jitter)}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Perdidos".padEnd(10))} ${times.length === count ? chalk.green.bold("0%") : chalk.red.bold(`${Math.round((1 - times.length / count) * 100)}%`)}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Gráfico".padEnd(10))} ${chalk.hex(ACCENT)(spark)}`);
    }

    console.log("");
    console.log(line(72));
    console.log("");
}

// ─── Monitoramento Contínuo ─────────────────────────────────────────

async function handleProbe(input: string, intervalStr: string): Promise<void> {
    const url = normalizeUrl(input);
    let intervalMs = 5000;
    const match = intervalStr.match(/^(\d+)(ms|s|m)$/);
    if (match) {
        const value = parseInt(match[1]!, 10);
        const unit = match[2]!;
        intervalMs = unit === "ms" ? value : unit === "s" ? value * 1000 : value * 60000;
    }

    console.log("");
    console.log(`   ${chalk.hex(ACCENT2).bold("⚡")} ${chalk.bold("Monitorando")} ${chalk.cyan.bold(url)}`);
    console.log(`   ${chalk.dim(`Intervalo: ${intervalStr} │ Pressione Ctrl+C para parar`)}`);
    console.log("");

    const scheduler = new ProbeScheduler({ targets: [{ url }], intervalMs, durationMs: 0, maxProbes: 0 });
    const responseTimes: number[] = [];
    const statuses: string[] = [];

    const handler = () => { scheduler.stop(); process.removeListener("SIGINT", handler); };
    process.on("SIGINT", handler);

    scheduler.on("probeComplete", (result) => {
        responseTimes.push(result.timings.total);
        statuses.push(result.status);
        const stats = computeStats(scheduler.getSession().results);

        if (responseTimes.length > 1) process.stdout.write(`\x1B[4A\x1B[J`);

        const badge = result.status === "up" ? chalk.green("●") : result.status === "degraded" ? chalk.yellow("◐") : chalk.red("○");
        const spark = sparkline(responseTimes, 40);
        const timeline = statuses.slice(-40).map(s => s === "up" ? chalk.green("●") : s === "degraded" ? chalk.yellow("◐") : chalk.red("○")).join("");

        console.log(`   ${badge} ${chalk.bold(result.label)} ${chalk.dim("│")} ${colorTime(result.timings.total)} ${chalk.dim("│")} HTTP ${result.statusCode ?? "ERR"}`);
        console.log(`   ${chalk.dim("Status:")}  ${timeline}`);
        console.log(`   ${chalk.dim("Latência:")} ${chalk.hex(ACCENT)(spark)}`);
        console.log(`   ${chalk.dim("Uptime:")} ${stats.uptimePercent >= 99 ? chalk.green(`${stats.uptimePercent}%`) : chalk.yellow(`${stats.uptimePercent}%`)} ${chalk.dim("│ Avg:")} ${formatResponseTime(stats.avgResponseTime)} ${chalk.dim("│ P95:")} ${formatResponseTime(stats.p95ResponseTime)} ${chalk.dim("│ Probes:")} ${stats.total}`);
    });

    scheduler.on("sessionEnd", () => {
        console.log("");
        console.log(`   ${chalk.dim("Monitoramento finalizado.")}`);
        console.log(line(72));
        console.log("");
    });

    await scheduler.start();
}

// ─── SSL ────────────────────────────────────────────────────────────

async function handleSslCheck(host: string): Promise<void> {
    const hostname = extractHostname(host);
    console.log("");
    console.log(`   ${chalk.dim("🔒 Verificando SSL de")} ${chalk.cyan.bold(hostname)}${chalk.dim("...")}`);
    console.log("");

    try {
        const cert = await sslProbe(hostname, 443);
        if (!cert) { console.log(`   ${chalk.red.bold("✕")} Não foi possível obter o certificado SSL\n`); return; }

        const health = evaluateCertHealth(cert);
        const hb = health === "healthy" ? chalk.bgGreen.black.bold(" SAUDÁVEL ") : health === "warning" ? chalk.bgYellow.black.bold(" ATENÇÃO ") : chalk.bgRed.white.bold(" CRÍTICO ");

        console.log(`   ${hb} ${chalk.bold(cert.subject)}`);
        console.log("");
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Sujeito".padEnd(14))} ${cert.subject}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Emissor".padEnd(14))} ${cert.issuer}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Protocolo".padEnd(14))} ${cert.protocol}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Válido de".padEnd(14))} ${cert.validFrom.toLocaleDateString("pt-BR")}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Válido até".padEnd(14))} ${cert.validTo.toLocaleDateString("pt-BR")}`);
        const ec = cert.daysUntilExpiry > 30 ? chalk.green : cert.daysUntilExpiry > 7 ? chalk.yellow : chalk.red;
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Expira em".padEnd(14))} ${ec.bold(`${cert.daysUntilExpiry} dias`)}`);
        console.log(`   ${chalk.dim("│")} ${chalk.dim("Válido".padEnd(14))} ${cert.isValid ? chalk.green.bold("✓ Sim") : chalk.red.bold("✕ Não")}`);
        console.log(""); console.log(line(72)); console.log("");
    } catch (err) { console.log(`   ${chalk.red.bold("✕")} ${chalk.red(String(err))}\n`); }
}

// ─── DNS ────────────────────────────────────────────────────────────

async function handleDnsCheck(host: string): Promise<void> {
    const hostname = extractHostname(host);
    console.log("");
    console.log(`   ${chalk.dim("🌐 Consultando DNS de")} ${chalk.cyan.bold(hostname)}${chalk.dim("...")}`);
    console.log("");

    try {
        const result = await dnsProbe(hostname);
        console.log(`   ${chalk.hex(ACCENT2).bold("DNS")} ${chalk.bold(hostname)} ${chalk.dim(`(${formatResponseTime(result.resolveTime)})`)}`);
        console.log("");
        if (result.ipv4.length > 0) console.log(`   ${chalk.dim("│")} ${chalk.blue.bold("A".padEnd(6))} ${result.ipv4.join(", ")}`);
        if (result.ipv6.length > 0) console.log(`   ${chalk.dim("│")} ${chalk.cyan.bold("AAAA".padEnd(6))} ${result.ipv6.join(", ")}`);
        if (result.mx.length > 0) for (const mx of result.mx) console.log(`   ${chalk.dim("│")} ${chalk.magenta.bold("MX".padEnd(6))} ${mx.exchange} ${chalk.dim(`(prioridade: ${mx.priority})`)}`);
        if (result.ns.length > 0) console.log(`   ${chalk.dim("│")} ${chalk.yellow.bold("NS".padEnd(6))} ${result.ns.join(", ")}`);
        console.log(""); console.log(line(72)); console.log("");
    } catch (err) { console.log(`   ${chalk.red.bold("✕")} ${chalk.red(String(err))}\n`); }
}

// ─── TCP ────────────────────────────────────────────────────────────

async function handleTcpCheck(host: string, port: number): Promise<void> {
    const hostname = extractHostname(host);
    console.log("");
    console.log(`   ${chalk.dim("🔌 Verificando")} ${chalk.cyan.bold(`${hostname}:${port}`)}${chalk.dim("...")}`);
    console.log("");

    try {
        const result = await tcpProbe(hostname, port);
        if (result.connected) {
            console.log(`   ${chalk.bgGreen.black.bold(" ABERTA ")} ${chalk.bold(`${hostname}:${port}`)} ${chalk.dim(`(${formatResponseTime(result.connectTime)})`)}`);
        } else {
            console.log(`   ${chalk.bgRed.white.bold(" FECHADA ")} ${chalk.bold(`${hostname}:${port}`)}`);
            if (result.error) console.log(`   ${chalk.dim("│")} ${chalk.red(result.error)}`);
        }
        console.log(""); console.log(line(72)); console.log("");
    } catch (err) { console.log(`   ${chalk.red.bold("✕")} ${chalk.red(String(err))}\n`); }
}

// ─── Scanner de Portas ──────────────────────────────────────────────

const COMMON_PORTS = [
    { port: 21, name: "FTP" },
    { port: 22, name: "SSH" },
    { port: 25, name: "SMTP" },
    { port: 53, name: "DNS" },
    { port: 80, name: "HTTP" },
    { port: 110, name: "POP3" },
    { port: 143, name: "IMAP" },
    { port: 443, name: "HTTPS" },
    { port: 465, name: "SMTPS" },
    { port: 587, name: "Submission" },
    { port: 993, name: "IMAPS" },
    { port: 995, name: "POP3S" },
    { port: 3000, name: "Dev Server" },
    { port: 3306, name: "MySQL" },
    { port: 5432, name: "PostgreSQL" },
    { port: 5900, name: "VNC" },
    { port: 6379, name: "Redis" },
    { port: 8080, name: "HTTP Alt" },
    { port: 8443, name: "HTTPS Alt" },
    { port: 9090, name: "Prometheus" },
    { port: 27017, name: "MongoDB" },
];

async function handlePortScan(host: string): Promise<void> {
    const hostname = extractHostname(host);
    console.log("");
    console.log(`   ${chalk.hex(ACCENT2).bold("🔌")} ${chalk.bold("Escaneando portas de")} ${chalk.cyan.bold(hostname)}`);
    console.log(`   ${chalk.dim(`Testando ${COMMON_PORTS.length} portas comuns...`)}`);
    console.log("");

    const openPorts: Array<{ port: number; name: string; time: number }> = [];
    const closedPorts: Array<{ port: number; name: string }> = [];

    const batchSize = 5;
    for (let i = 0; i < COMMON_PORTS.length; i += batchSize) {
        const batch = COMMON_PORTS.slice(i, i + batchSize);
        const results = await Promise.allSettled(
            batch.map(async ({ port, name }) => {
                const result = await tcpProbe(hostname, port);
                return { port, name, connected: result.connected, time: result.connectTime };
            }),
        );

        for (const r of results) {
            if (r.status === "fulfilled") {
                if (r.value.connected) {
                    openPorts.push({ port: r.value.port, name: r.value.name, time: r.value.time });
                    console.log(`   ${chalk.green("●")} ${chalk.bold(String(r.value.port).padEnd(6))} ${chalk.dim(r.value.name.padEnd(14))} ${chalk.green.bold("aberta")} ${chalk.dim(formatResponseTime(r.value.time))}`);
                } else {
                    closedPorts.push({ port: r.value.port, name: r.value.name });
                }
            }
        }

        const progress = Math.round(((i + batch.length) / COMMON_PORTS.length) * 25);
        process.stdout.write(`\r   ${chalk.dim("Progresso:")} ${chalk.hex(ACCENT)("█".repeat(progress))}${chalk.hex("#333333")("░".repeat(25 - progress))}`);
    }

    process.stdout.write("\r\x1B[K");
    console.log("");
    console.log(`   ${chalk.green.bold(`${openPorts.length}`)} ${chalk.bold("abertas")} ${chalk.dim("/")} ${chalk.red(`${closedPorts.length}`)} ${chalk.dim("fechadas")} ${chalk.dim(`(de ${COMMON_PORTS.length} testadas)`)}`);
    console.log(""); console.log(line(72)); console.log("");
}

// ─── Scanner Tecnológico (Wappalyzer Ultra-Light) ───────────────────

async function handleTech(input: string): Promise<void> {
    const url = normalizeUrl(input);
    console.log("");
    console.log(`   ${chalk.hex(ACCENT2).bold("🕵️‍♂️")} ${chalk.bold("Detectando stack tecnológico de")} ${chalk.cyan.bold(url)}${chalk.dim("...")}`);
    console.log("");

    try {
        const response = await request(url, { method: "GET", signal: AbortSignal.timeout(10000) });
        const html = await response.body.text();
        const headers = JSON.stringify(response.headers).toLowerCase();

        const signatures = [
            { name: "Cloudflare", type: "CDN", headers: /"server":"cloudflare"/i },
            { name: "Nginx", type: "Servidor Web", headers: /"server":"nginx/i },
            { name: "Apache", type: "Servidor Web", headers: /"server":"apache/i },
            { name: "Vercel", type: "Hospedagem", headers: /"x-vercel-id"/i },
            { name: "Next.js", type: "Framework React", headers: /"x-powered-by":"next\.js"/i, html: /id="__next"/i },
            { name: "Nuxt.js", type: "Framework Vue", html: /window\.__NUXT__/i },
            { name: "React", type: "Library UI", html: /data-reactroot/i },
            { name: "Vue.js", type: "Library UI", html: /data-v-[a-z0-9]+=""/i },
            { name: "WordPress", type: "CMS", headers: /"link":"[^"]*wp-json/i, html: /\/wp-content\//i },
            { name: "PHP", type: "Linguagem", headers: /"x-powered-by":"php/i },
            { name: "Express", type: "Framework Node", headers: /"x-powered-by":"express"/i },
            { name: "ASP.NET", type: "Framework C#", headers: /"x-powered-by":"asp\.net"/i },
            { name: "Tailwind CSS", type: "Estilização", html: /class="[^"]*tw-[a-z0-9]/i },
            { name: "Google Analytics", type: "Analytics", html: /googletagmanager\.com\/gtag\/js/i },
            { name: "Shopify", type: "E-commerce", html: /cdn\.shopify\.com/i },
        ];

        const found: Array<{ name: string; type: string }> = [];

        for (const sig of signatures) {
            let matched = false;
            if (sig.headers && sig.headers.test(headers)) matched = true;
            if (sig.html && sig.html.test(html)) matched = true;

            if (matched) {
                found.push({ name: sig.name, type: sig.type });
            }
        }

        if (found.length === 0) {
            console.log(`   ${chalk.yellow("Nenhuma tecnologia conhecida detectada de forma óbvia.")}`);
            console.log(`   ${chalk.dim("A API/Site pode estar ocultando headers ou ser puramente customizada.")}`);
        } else {
            console.log(`   ${chalk.green.bold(`${found.length}`)} ${chalk.bold("tecnologias detectadas:")}\n`);

            // agrupar por tipo pra ficar chique
            const types = [...new Set(found.map(f => f.type))];

            for (const type of types) {
                const techs = found.filter(f => f.type === type).map(f => f.name).join(", ");
                console.log(`   ${chalk.dim("│")} ${chalk.hex(ACCENT).bold(type.padEnd(16))} ${chalk.white(techs)}`);
            }
        }

        console.log(""); console.log(line(72)); console.log("");

    } catch (err) {
        console.log(`   ${chalk.red.bold("✕")} ${chalk.red(String(err))}`);
        console.log("");
    }
}

// ─── Cadeia de Redirects ────────────────────────────────────────────

async function handleRedirects(input: string): Promise<void> {
    let url = normalizeUrl(input);
    console.log("");
    console.log(`   ${chalk.hex(ACCENT2).bold("🔗")} ${chalk.bold("Seguindo redirects de")} ${chalk.cyan.bold(url)}`);
    console.log("");

    const chain: Array<{ url: string; status: number; location: string }> = [];
    const maxRedirects = 15;

    try {
        for (let i = 0; i < maxRedirects; i++) {
            const response = await request(url, { method: "GET", signal: AbortSignal.timeout(10000) });
            await response.body.arrayBuffer();

            const locationHeader = response.headers.location;
            const location = Array.isArray(locationHeader) ? locationHeader[0] : locationHeader;
            const status = response.statusCode;

            if (status < 300 || status >= 400 || !location) {
                const badge = status >= 200 && status < 300 ? chalk.bgGreen.black.bold(` ${status} `) : chalk.bgRed.white.bold(` ${status} `);
                console.log(`   ${chalk.dim(String(chain.length + 1).padStart(2) + ".")} ${badge} ${chalk.bold(url)} ${chalk.green.bold("← destino final")}`);
                break;
            }

            const nextUrl = location.startsWith("http") ? location : new URL(location, url).toString();
            const statusColor = status === 301 ? chalk.yellow : status === 302 ? chalk.cyan : chalk.hex(ACCENT);
            console.log(`   ${chalk.dim(String(chain.length + 1).padStart(2) + ".")} ${statusColor.bold(`[${status}]`)} ${chalk.dim(url)}`);
            console.log(`      ${chalk.dim("→")} ${chalk.cyan(nextUrl)}`);

            chain.push({ url, status, location: nextUrl });
            url = nextUrl;
        }

        console.log("");
        console.log(`   ${chalk.dim(chain.length > 0 ? `${chain.length} redirect${chain.length > 1 ? "s" : ""} encontrado${chain.length > 1 ? "s" : ""}` : "Nenhum redirect")}`);
    } catch (err) {
        console.log(`   ${chalk.red.bold("✕")} ${chalk.red(String(err))}`);
    }

    console.log(""); console.log(line(72)); console.log("");
}

// ─── Subdomínios ────────────────────────────────────────────────────

async function handleSubdomains(host: string): Promise<void> {
    const hostname = extractHostname(host);
    console.log("");
    console.log(`   ${chalk.hex(ACCENT2).bold("🔍")} ${chalk.bold("Descobrindo subdomínios de")} ${chalk.cyan.bold(hostname)}`);
    console.log(`   ${chalk.dim(`Testando ${SUBDOMAIN_PREFIXES.length} prefixos (aguarde uns segundos)...`)}`);
    console.log("");

    const found: Array<{ subdomain: string; addresses: string[] }> = [];
    let checked = 0;
    const batchSize = 10;

    for (let i = 0; i < SUBDOMAIN_PREFIXES.length; i += batchSize) {
        const batch = SUBDOMAIN_PREFIXES.slice(i, i + batchSize);
        const results = await Promise.allSettled(
            batch.map(async (prefix) => {
                const subdomain = `${prefix}.${hostname}`;
                try {
                    const { lookup } = await import("node:dns/promises");
                    const addrs = await lookup(subdomain, { all: true });
                    return { subdomain, addresses: addrs.map((a) => a.address) };
                } catch { return null; }
            }),
        );

        for (const result of results) {
            checked++;
            if (result.status === "fulfilled" && result.value) {
                found.push(result.value);
            }
        }

        const progress = Math.round((checked / SUBDOMAIN_PREFIXES.length) * 30);
        process.stdout.write(`\r   ${chalk.dim("Progresso:")} ${chalk.hex(ACCENT)("█".repeat(progress))}${chalk.hex("#333333")("░".repeat(30 - progress))} ${chalk.dim(`${checked}/${SUBDOMAIN_PREFIXES.length}`)}`);
    }

    // apaga a barra de progresso
    process.stdout.write("\r\x1B[K");

    if (found.length === 0) {
        console.log(`   ${chalk.yellow("Nenhum subdomínio ativo encontrado para")} ${chalk.bold(hostname)}`);
    } else {
        // listar tudo de uma vez no finalzinho bonitinho
        console.log(`   ${chalk.hex(ACCENT2).bold(`${found.length}`)} ${chalk.bold("subdomínios encontrados:")}\n`);

        // ordernar em ordem alfabetica pra ficar chique
        found.sort((a, b) => a.subdomain.localeCompare(b.subdomain));

        for (const item of found) {
            console.log(`   ${chalk.green("✓")} ${chalk.bold(item.subdomain.padEnd(25))} ${chalk.dim(item.addresses.join(", "))}`);
        }
    }
    console.log(""); console.log(line(72)); console.log("");
}

// ─── Crawler de Caminhos (Paths) ────────────────────────────────────

async function handlePaths(input: string): Promise<void> {
    const url = normalizeUrl(input);
    const hostname = extractHostname(url);
    console.log("");
    console.log(`   ${chalk.hex(ACCENT2).bold("🕸️")} ${chalk.bold("Vasculhando caminhos em")} ${chalk.cyan.bold(url)}${chalk.dim("...")}`);
    console.log("");

    try {
        const response = await request(url, { method: "GET", signal: AbortSignal.timeout(10000) });
        const html = await response.body.text();

        // regex ultra-rapido pra extrair os hrefs das tags <a>
        const hrefRegex = /href=["'](.*?)["']/gi;
        const rawPaths = new Set<string>();
        let match;

        while ((match = hrefRegex.exec(html)) !== null) {
            if (match[1]) {
                const link = match[1].trim();

                // ignorar lixos (javascript:, mailto:, ancora pura)
                if (link.startsWith("javascript:") || link.startsWith("mailto:") || link.startsWith("tel:") || link === "#") continue;

                // pega so caminhos absolutos /relativos do mesmo site, ou URL completa se for do mesmo dominio
                if (link.startsWith("/")) {
                    // ignora //. Que é link sem protocolo
                    if (!link.startsWith("//")) rawPaths.add(link);
                } else if (link.startsWith(`http://${hostname}`) || link.startsWith(`https://${hostname}`)) {
                    try {
                        const parsed = new URL(link);
                        rawPaths.add(parsed.pathname + parsed.search);
                    } catch { }
                }
            }
        }

        const paths = Array.from(rawPaths).sort();

        if (paths.length === 0) {
            console.log(`   ${chalk.yellow("Nenhum caminho local encontrado nesta página.")}`);
        } else {
            console.log(`   ${chalk.green.bold(`${paths.length}`)} ${chalk.bold("caminhos detectados no HTML:")}\n`);

            // se tiver muito, mostra os 50 primeiros pra nao inundar o terminal
            const limit = 50;
            const toShow = paths.slice(0, limit);

            for (const p of toShow) {
                console.log(`   ${chalk.dim("│")} ${chalk.cyan(p)}`);
            }

            if (paths.length > limit) {
                console.log(`   ${chalk.dim("│")} ${chalk.dim(`... e mais ${paths.length - limit} caminhos ocultos.`)}`);
            }
        }

        console.log(""); console.log(line(72)); console.log("");

    } catch (err) {
        console.log(`   ${chalk.red.bold("✕")} ${chalk.red(String(err))}`);
        console.log("");
    }
}

// ─── REPL Principal ─────────────────────────────────────────────────

export async function startInteractive(): Promise<void> {
    renderWelcome();

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `   ${chalk.hex(ACCENT).bold("httpulse")} ${chalk.hex(ACCENT2)("›")} `,
    });

    rl.prompt();

    rl.on("line", async (input) => {
        const trimmed = input.trim();
        if (!trimmed) { rl.prompt(); return; }

        const parts = trimmed.split(/\s+/);
        const cmd = parts[0]!.toLowerCase();

        try {
            switch (cmd) {
                case "sair": case "exit": case "quit":
                    console.log(`\n   ${chalk.hex(ACCENT2)("👋")} ${chalk.dim("Valeu, até mais!")}\n`);
                    process.exit(0);
                    break;
                case "limpar": case "clear": case "voltar": case "inicio": case "home":
                    renderWelcome(); break;
                case "ajuda": case "help":
                    renderHelp(); break;
                case "check":
                    if (parts[1]) await handleUrlCheck(parts[1]);
                    else console.log(`\n   ${chalk.yellow("Uso:")} check <url>\n   ${chalk.dim("Ex: check api.github.com")}\n`);
                    break;
                case "probe":
                    if (parts[1]) await handleProbe(parts[1], parts[2] ?? "5s");
                    else console.log(`\n   ${chalk.yellow("Uso:")} probe <url> [intervalo]\n   ${chalk.dim("Ex: probe google.com 3s")}\n`);
                    break;
                case "headers": case "header":
                    if (parts[1]) await handleHeaders(parts[1]);
                    else console.log(`\n   ${chalk.yellow("Uso:")} headers <url>\n   ${chalk.dim("Ex: headers api.github.com")}\n`);
                    break;
                case "comparar": case "compare":
                    if (parts.length >= 3) await handleCompare(parts.slice(1));
                    else console.log(`\n   ${chalk.yellow("Uso:")} comparar <url1> <url2> ...\n   ${chalk.dim("Ex: comparar google.com github.com")}\n`);
                    break;
                case "ping":
                    if (parts[1]) { const n = parts[2] ? parseInt(parts[2], 10) : 5; await handlePing(parts[1], isNaN(n) ? 5 : n); }
                    else console.log(`\n   ${chalk.yellow("Uso:")} ping <url> [n]\n   ${chalk.dim("Ex: ping google.com 10")}\n`);
                    break;
                case "geo": case "ip": case "locate":
                    if (parts[1]) await handleGeoIp(parts[1]);
                    else console.log(`\n   ${chalk.yellow("Uso:")} geo <host>\n   ${chalk.dim("Ex: geo github.com")}\n`);
                    break;
                case "ssl":
                    if (parts[1]) await handleSslCheck(parts[1]);
                    else console.log(`\n   ${chalk.yellow("Uso:")} ssl <host>\n   ${chalk.dim("Ex: ssl google.com")}\n`);
                    break;
                case "dns":
                    if (parts[1]) await handleDnsCheck(parts[1]);
                    else console.log(`\n   ${chalk.yellow("Uso:")} dns <host>\n   ${chalk.dim("Ex: dns github.com")}\n`);
                    break;
                case "tcp":
                    if (parts[1] && parts[2]) {
                        const port = parseInt(parts[2], 10);
                        if (isNaN(port)) console.log(`\n   ${chalk.red("Porta inválida:")} ${parts[2]}\n`);
                        else await handleTcpCheck(parts[1], port);
                    } else console.log(`\n   ${chalk.yellow("Uso:")} tcp <host> <porta>\n   ${chalk.dim("Ex: tcp github.com 443")}\n`);
                    break;
                case "subdominios": case "subdomains": case "sub":
                    if (parts[1]) await handleSubdomains(parts[1]);
                    else console.log(`\n   ${chalk.yellow("Uso:")} subdominios <host>\n   ${chalk.dim("Ex: subdominios github.com")}\n`);
                    break;
                case "portas": case "ports": case "scan":
                    if (parts[1]) await handlePortScan(parts[1]);
                    else console.log(`\n   ${chalk.yellow("Uso:")} portas <host>\n   ${chalk.dim("Ex: portas github.com")}\n`);
                    break;
                case "redirects": case "redirect": case "redir":
                    if (parts[1]) await handleRedirects(parts[1]);
                    else console.log(`\n   ${chalk.yellow("Uso:")} redirects <url>\n   ${chalk.dim("Ex: redirects http://github.com")}\n`);
                    break;
                case "tech": case "stack": case "tecnologias":
                    if (parts[1]) await handleTech(parts[1]);
                    else console.log(`\n   ${chalk.yellow("Uso:")} tech <url>\n   ${chalk.dim("Ex: tech github.com")}\n`);
                    break;
                case "paths": case "caminhos": case "crawl": case "find":
                    if (parts[1]) await handlePaths(parts[1]);
                    else console.log(`\n   ${chalk.yellow("Uso:")} paths <url>\n   ${chalk.dim("Ex: paths github.com")}\n`);
                    break;
                default:
                    // Se não for nenhum comando conhecido, tenta fazer o check da URL direto
                    await handleUrlCheck(trimmed);
                    break;
            }
        } catch (err) {
            console.log(`\n   ${chalk.red.bold("✕ Erro:")} ${err instanceof Error ? err.message : String(err)}\n`);
        }

        if (!["limpar", "clear", "voltar", "inicio", "home", "ajuda", "help", "sair", "exit", "quit"].includes(cmd)) {
            console.log(`   ${chalk.dim(`💡 Dica: digite 'voltar' para ir ao menu inicial.`)}\n`);
        }

        rl.prompt();
    });

    rl.on("close", () => {
        console.log(`\n   ${chalk.hex(ACCENT2)("👋")} ${chalk.dim("Valeu, até mais!")}\n`);
        process.exit(0);
    });
}
