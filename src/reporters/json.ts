import type { ProbeSession } from "../core/types.js";

// entrega o json mastigadinho pros dev q forem engolir via api dps
export function generateJsonReport(session: ProbeSession): string {
    const serializable = {
        id: session.id,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt?.toISOString() ?? null,
        targets: session.targets,
        results: session.results.map((r) => ({
            ...r,
            timestamp: r.timestamp.toISOString(),
            certificate: r.certificate
                ? {
                    ...r.certificate,
                    validFrom: r.certificate.validFrom.toISOString(),
                    validTo: r.certificate.validTo.toISOString(),
                }
                : null,
        })),
        stats: Object.fromEntries(session.stats),
    };

    return JSON.stringify(serializable, null, 2);
}
