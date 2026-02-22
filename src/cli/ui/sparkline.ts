

const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

// mágica pura: faz aqueles graficozinhos ascii irados estilo ▃▆██▇ com a latenciia
export function sparkline(values: number[], width = 50): string {
    if (values.length === 0) return "";

    // Usar apenas os últimos `width` valores
    const data = values.slice(-width);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min;

    if (range === 0) {
        return BLOCKS[3]!.repeat(data.length);
    }

    return data
        .map((value) => {
            const normalized = (value - min) / range;
            const index = Math.min(Math.round(normalized * (BLOCKS.length - 1)), BLOCKS.length - 1);
            return BLOCKS[index];
        })
        .join("");
}

// barrona horizontal do terminal 
export function horizontalBar(value: number, max: number, width = 20): string {
    if (max === 0) return "░".repeat(width);

    const filled = Math.round((value / max) * width);
    const empty = width - filled;

    return "█".repeat(filled) + "░".repeat(empty);
}

// a bolinha q vira verde/vermelho pisca-pisca
export function statusDot(status: "up" | "down" | "degraded" | "timeout" | "error"): string {
    switch (status) {
        case "up":
            return "●";
        case "degraded":
            return "◐";
        case "down":
            return "○";
        case "timeout":
            return "◌";
        case "error":
            return "✕";
    }
}

// mostra o historico das ultimas bolinhas numa tripinha colorida
export function statusTimeline(
    statuses: Array<"up" | "down" | "degraded" | "timeout" | "error">,
    width = 50,
): string {
    const data = statuses.slice(-width);
    return data.map(statusDot).join("");
}
