import type { DnsInfo } from "../core/types.js";
import { lookup, resolve4, resolve6, resolveMx, resolveNs } from "node:dns/promises";

// mais um pouco de info de dns junto (mx, ipv6)
export interface ExtendedDnsInfo extends DnsInfo {

    ipv4: string[];

    ipv6: string[];

    mx: Array<{ exchange: string; priority: number }>;

    ns: string[];
}

// puxa a capivara toda do dns do cara: ipv4, ipv6, mx (email) e ns (name servers)
export async function dnsProbe(hostname: string): Promise<ExtendedDnsInfo> {
    const start = performance.now();

    // Executar todas as consultas DNS simultaneamente
    const [lookupResult, ipv4Result, ipv6Result, mxResult, nsResult] = await Promise.allSettled([
        lookup(hostname, { all: true }),
        resolve4(hostname),
        resolve6(hostname),
        resolveMx(hostname),
        resolveNs(hostname),
    ]);

    const resolveTime = Math.round((performance.now() - start) * 100) / 100;

    // Extrair endereços da consulta principal
    const addresses: string[] = [];
    if (lookupResult.status === "fulfilled") {
        for (const r of lookupResult.value) {
            addresses.push(r.address);
        }
    }

    return {
        addresses,
        resolveTime,
        ipv4: ipv4Result.status === "fulfilled" ? ipv4Result.value : [],
        ipv6: ipv6Result.status === "fulfilled" ? ipv6Result.value : [],
        mx:
            mxResult.status === "fulfilled"
                ? mxResult.value.map((r) => ({ exchange: r.exchange, priority: r.priority }))
                : [],
        ns: nsResult.status === "fulfilled" ? nsResult.value : [],
    };
}

// resolve só o basicão (ips) pra gente conectar rapidao
export async function dnsResolve(hostname: string): Promise<DnsInfo> {
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
