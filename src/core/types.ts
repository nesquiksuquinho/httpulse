

// ─── Configuração de Sonda ─────────────────────────────────────────

export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS";

// a fita toda do alvo q a gente vai bisbilhotar (url, timeout, headers)
export interface ProbeTarget {
    
    url: string;
    
    method?: HttpMethod;
    
    headers?: Record<string, string>;
    
    body?: string;
    
    timeout?: number;
    
    expectedStatus?: number;
    
    label?: string;
    
    followRedirects?: boolean;
}

// ─── Resultados da Sonda ────────────────────────────────────────────

export type ProbeStatus = "up" | "down" | "degraded" | "timeout" | "error";

// tempos destrinchados de cada parte da jornada (tcp, tls, dns, ttfb)
export interface RequestTimings {
    
    dns: number;
    
    tcp: number;
    
    tls: number;
    
    ttfb: number;
    
    total: number;
}

// o que a gente tira de info valiosa do certificado ssl
export interface CertificateInfo {
    
    subject: string;
    
    issuer: string;
    
    validFrom: Date;
    
    validTo: Date;
    
    daysUntilExpiry: number;
    
    isValid: boolean;
    
    protocol: string;
}

// as respostas das consultas dns (ips, mx, ns)
export interface DnsInfo {
    
    addresses: string[];
    
    resolveTime: number;
}

// o pacote completao q volta dps da pipocada na url
export interface ProbeResult {
    
    url: string;
    
    label: string;
    
    status: ProbeStatus;
    
    statusCode: number | null;
    
    timings: RequestTimings;
    
    certificate: CertificateInfo | null;
    
    dns: DnsInfo | null;
    
    error: string | null;
    
    timestamp: Date;
    
    responseSize: number;
}

// ─── Sessão & Métricas ──────────────────────────────────────────────

// estatisticas cabulosas agregadas de varias sondas
export interface ProbeStats {
    
    total: number;
    
    successful: number;
    
    failed: number;
    
    uptimePercent: number;
    
    avgResponseTime: number;
    
    minResponseTime: number;
    
    maxResponseTime: number;
    
    p50ResponseTime: number;
    
    p95ResponseTime: number;
    
    p99ResponseTime: number;
    
    responseTimeHistory: number[];
}

// guarda a sessao inteira de testes como se fosse uma prancheta
export interface ProbeSession {
    
    id: string;
    
    startedAt: Date;
    
    endedAt: Date | null;
    
    targets: ProbeTarget[];
    
    results: ProbeResult[];
    
    stats: Map<string, ProbeStats>;
}

// ─── Agendador ──────────────────────────────────────────────────────

// lero lero de configuracoes do comportamento agendador
export interface SchedulerConfig {
    
    targets: ProbeTarget[];
    
    intervalMs: number;
    
    durationMs: number;
    
    maxProbes: number;
}

// ─── Callbacks de Eventos ───────────────────────────────────────────

export type OnProbeComplete = (result: ProbeResult) => void;

export type OnSessionEnd = (session: ProbeSession) => void;

export type OnProbeError = (error: Error, target: ProbeTarget) => void;

// ─── Opções de Relatório ────────────────────────────────────────────

export type ReportFormat = "json" | "markdown" | "html";

// o que o cara q rodou o comando enviou pras args do relatorio
export interface ReportOptions {
    
    format: ReportFormat;
    
    outputPath?: string;
    
    includeTimings?: boolean;
    
    includeCertificates?: boolean;
}
