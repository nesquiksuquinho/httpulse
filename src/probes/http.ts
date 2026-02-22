import type { ProbeResult, ProbeTarget, RequestTimings } from "../core/types.js";
import { request } from "undici";

const DEFAULT_TIMEOUT = 10_000;

// faz a batida policial na url pra ver cronometragem (ttfb, tempo total) e se o status ta igual esperado
export async function httpProbe(target: ProbeTarget): Promise<ProbeResult> {
    const url = new URL(target.url);
    const label = target.label ?? url.hostname;
    const timeout = target.timeout ?? DEFAULT_TIMEOUT;
    const expectedStatus = target.expectedStatus ?? 200;

    const timings: RequestTimings = {
        dns: 0,
        tcp: 0,
        tls: 0,
        ttfb: 0,
        total: 0,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const start = performance.now();

    try {
        const response = await request(target.url, {
            method: target.method ?? "GET",
            headers: target.headers,
            body: target.body,
            signal: controller.signal,
        });

        timings.ttfb = Math.round((performance.now() - start) * 100) / 100;

        const bodyBuffer = await response.body.arrayBuffer();
        const responseSize = bodyBuffer.byteLength;

        timings.total = Math.round((performance.now() - start) * 100) / 100;

        clearTimeout(timeoutId);

        const isExpected = response.statusCode === expectedStatus;
        const isDegraded = timings.total > 3000;

        return {
            url: target.url,
            label,
            status: isExpected && !isDegraded ? "up" : "degraded",
            statusCode: response.statusCode,
            timings,
            certificate: null,
            dns: null,
            error: null,
            timestamp: new Date(),
            responseSize,
        };
    } catch (err) {
        clearTimeout(timeoutId);
        timings.total = Math.round((performance.now() - start) * 100) / 100;

        const isTimeout =
            err instanceof Error &&
            (err.name === "AbortError" || err.message.includes("abort"));

        return {
            url: target.url,
            label,
            status: isTimeout ? "timeout" : "down",
            statusCode: null,
            timings,
            certificate: null,
            dns: null,
            error: err instanceof Error ? err.message : String(err),
            timestamp: new Date(),
            responseSize: 0,
        };
    }
}
