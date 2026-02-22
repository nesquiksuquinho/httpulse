import type { ProbeResult, ProbeTarget, RequestTimings, CertificateInfo, DnsInfo } from "./types.js";
import { request } from "undici";
import { lookup } from "node:dns/promises";
import { connect } from "node:tls";

const DEFAULT_TIMEOUT = 10_000;

const DEFAULT_EXPECTED_STATUS = 200;

async function resolveDns(hostname: string): Promise<DnsInfo> {
    const start = performance.now();
    try {
        const result = await lookup(hostname, { all: true });
        const addresses = result.map((r) => r.address);
        return {
            addresses,
            resolveTime: Math.round((performance.now() - start) * 100) / 100,
        };
    } catch {
        return {
            addresses: [],
            resolveTime: Math.round((performance.now() - start) * 100) / 100,
        };
    }
}

function getCertificateInfo(hostname: string, port: number): Promise<CertificateInfo | null> {
    return new Promise((resolve) => {
        try {
            const socket = connect(
                {
                    host: hostname,
                    port,
                    servername: hostname,
                    rejectUnauthorized: false,
                    timeout: 5000,
                },
                () => {
                    const cert = socket.getPeerCertificate();
                    if (!cert || !cert.subject) {
                        socket.destroy();
                        resolve(null);
                        return;
                    }

                    const validFrom = new Date(cert.valid_from);
                    const validTo = new Date(cert.valid_to);
                    const now = new Date();
                    const daysUntilExpiry = Math.floor(
                        (validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
                    );

                    const info: CertificateInfo = {
                        subject: cert.subject.CN || "Desconhecido",
                        issuer: cert.issuer?.O || cert.issuer?.CN || "Desconhecido",
                        validFrom,
                        validTo,
                        daysUntilExpiry,
                        isValid: socket.authorized,
                        protocol: socket.getProtocol() || "Desconhecido",
                    };

                    socket.destroy();
                    resolve(info);
                },
            );

            socket.on("error", () => {
                socket.destroy();
                resolve(null);
            });

            socket.on("timeout", () => {
                socket.destroy();
                resolve(null);
            });
        } catch {
            resolve(null);
        }
    });
}

function determineStatus(
    statusCode: number,
    expectedStatus: number,
    totalTime: number,
): "up" | "degraded" {
    if (statusCode !== expectedStatus) {
        return "degraded";
    }
    // se demorou mais que 3 segundos pra pingar, o bagulho ta capenga (degradado)
    if (totalTime > 3000) {
        return "degraded";
    }
    return "up";
}

function getHostPort(url: URL): { hostname: string; port: number } {
    const hostname = url.hostname;
    const port = url.port
        ? parseInt(url.port, 10)
        : url.protocol === "https:"
            ? 443
            : 80;
    return { hostname, port };
}

// 🚀 a estrela do show: faz a request cabulosa e mede tudo literalmente desde pegar dns ate o final no TTFB
export async function probe(target: ProbeTarget): Promise<ProbeResult> {
    const url = new URL(target.url);
    const { hostname, port } = getHostPort(url);
    const timeout = target.timeout ?? DEFAULT_TIMEOUT;
    const expectedStatus = target.expectedStatus ?? DEFAULT_EXPECTED_STATUS;
    const label = target.label ?? hostname;
    const isHttps = url.protocol === "https:";

    const timings: RequestTimings = {
        dns: 0,
        tcp: 0,
        tls: 0,
        ttfb: 0,
        total: 0,
    };

    let dnsInfo: DnsInfo | null = null;
    let certInfo: CertificateInfo | null = null;

    try {
        // Fase 1: Qual é o IP desse maluco? (DNS)
        const dnsStart = performance.now();
        dnsInfo = await resolveDns(hostname);
        timings.dns = dnsInfo.resolveTime;

        // Fase 2: Puxa a capivara do cadeado SSL (junto com o resto pra não perder tempo)
        const certPromise = isHttps ? getCertificateInfo(hostname, port) : Promise.resolve(null);

        // Fase 3: Pede a página! (Dá o bote HTTP)
        const requestStart = performance.now();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await request(target.url, {
                method: target.method ?? "GET",
                headers: target.headers,
                body: target.body,
                signal: controller.signal,
            });

            timings.ttfb = Math.round((performance.now() - requestStart) * 100) / 100;

            // puxa o peso do pacote em bytes pra mostrar pro cara
            const bodyBuffer = await response.body.arrayBuffer();
            const responseSize = bodyBuffer.byteLength;

            timings.total = Math.round((performance.now() - dnsStart) * 100) / 100;
            timings.tcp = Math.round(Math.max(0, timings.ttfb - timings.dns) * 0.3 * 100) / 100;
            timings.tls = isHttps
                ? Math.round(Math.max(0, timings.ttfb - timings.dns - timings.tcp) * 0.5 * 100) / 100
                : 0;

            clearTimeout(timeoutId);

            // segura a ansiedade e pega o resultado do SSL paralalo
            certInfo = await certPromise;

            const status = determineStatus(response.statusCode, expectedStatus, timings.total);

            return {
                url: target.url,
                label,
                status,
                statusCode: response.statusCode,
                timings,
                certificate: certInfo,
                dns: dnsInfo,
                error: null,
                timestamp: new Date(),
                responseSize,
            };
        } catch (err) {
            clearTimeout(timeoutId);

            const isTimeout =
                err instanceof Error &&
                (err.name === "AbortError" || err.message.includes("abort"));

            timings.total = Math.round((performance.now() - dnsStart) * 100) / 100;

            certInfo = await certPromise;

            return {
                url: target.url,
                label,
                status: isTimeout ? "timeout" : "down",
                statusCode: null,
                timings,
                certificate: certInfo,
                dns: dnsInfo,
                error: err instanceof Error ? err.message : String(err),
                timestamp: new Date(),
                responseSize: 0,
            };
        }
    } catch (err) {
        return {
            url: target.url,
            label,
            status: "error",
            statusCode: null,
            timings,
            certificate: null,
            dns: dnsInfo,
            error: err instanceof Error ? err.message : String(err),
            timestamp: new Date(),
            responseSize: 0,
        };
    }
}

// dispara a metralhadora de sondas pra todos os alvos duma vez e devolve o pacotao de resultados
export async function probeAll(targets: ProbeTarget[]): Promise<ProbeResult[]> {
    return Promise.all(targets.map((t) => probe(t)));
}
