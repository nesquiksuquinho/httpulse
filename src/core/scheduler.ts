import { randomUUID } from "node:crypto";
import type {
    ProbeSession,
    ProbeTarget,
    SchedulerConfig,
    OnProbeComplete,
    OnSessionEnd,
    OnProbeError,
} from "./types.js";
import { probe } from "./prober.js";
import { computeSessionStats } from "./analyzer.js";

interface SchedulerListeners {
    onProbeComplete: OnProbeComplete[];
    onSessionEnd: OnSessionEnd[];
    onProbeError: OnProbeError[];
}

// o cerebro das operacoes. agenda e dispara cada onda de requisições no tempo certo
export class ProbeScheduler {
    private readonly config: SchedulerConfig;
    private readonly session: ProbeSession;
    private readonly listeners: SchedulerListeners;
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private timeoutId: ReturnType<typeof setTimeout> | null = null;
    private probeCount = 0;
    private running = false;

    constructor(config: SchedulerConfig) {
        this.config = config;
        this.listeners = {
            onProbeComplete: [],
            onSessionEnd: [],
            onProbeError: [],
        };

        this.session = {
            id: randomUUID(),
            startedAt: new Date(),
            endedAt: null,
            targets: config.targets,
            results: [],
            stats: new Map(),
        };
    }

    on(event: "probeComplete", callback: OnProbeComplete): this;
    on(event: "sessionEnd", callback: OnSessionEnd): this;
    on(event: "probeError", callback: OnProbeError): this;
    on(
        event: "probeComplete" | "sessionEnd" | "probeError",
        callback: OnProbeComplete | OnSessionEnd | OnProbeError,
    ): this {
        switch (event) {
            case "probeComplete":
                this.listeners.onProbeComplete.push(callback as OnProbeComplete);
                break;
            case "sessionEnd":
                this.listeners.onSessionEnd.push(callback as OnSessionEnd);
                break;
            case "probeError":
                this.listeners.onProbeError.push(callback as OnProbeError);
                break;
        }
        return this;
    }

    async start(): Promise<ProbeSession> {
        if (this.running) {
            throw new Error("O agendador já está em execução");
        }

        this.running = true;

        // Configurar timeout de duração se definido
        if (this.config.durationMs > 0) {
            this.timeoutId = setTimeout(() => {
                this.stop();
            }, this.config.durationMs);
        }

        // Executar primeira sonda imediatamente
        await this.executeProbeRound();

        // Agendar sondas subsequentes
        if (this.running) {
            this.intervalId = setInterval(async () => {
                await this.executeProbeRound();
            }, this.config.intervalMs);
        }

        // Retorna uma promise que resolve quando a sessão termina
        return new Promise<ProbeSession>((resolve) => {
            if (!this.running) {
                resolve(this.session);
                return;
            }

            this.on("sessionEnd", (session) => {
                resolve(session);
            });
        });
    }

    stop(): void {
        if (!this.running) return;

        this.running = false;

        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        // Finalizar sessão
        this.session.endedAt = new Date();
        this.session.stats = computeSessionStats(this.session.results);

        // Notificar ouvintes
        for (const listener of this.listeners.onSessionEnd) {
            listener(this.session);
        }
    }

    get isRunning(): boolean {
        return this.running;
    }

    getSession(): ProbeSession {
        this.session.stats = computeSessionStats(this.session.results);
        return this.session;
    }

    private async executeProbeRound(): Promise<void> {
        if (!this.running) return;

        const probePromises = this.config.targets.map((target) =>
            this.executeSingleProbe(target),
        );

        await Promise.allSettled(probePromises);

        // Verificar se atingimos o limite máximo de sondas
        if (this.config.maxProbes > 0 && this.probeCount >= this.config.maxProbes) {
            this.stop();
        }
    }

    private async executeSingleProbe(target: ProbeTarget): Promise<void> {
        try {
            const result = await probe(target);
            this.probeCount++;
            this.session.results.push(result);

            for (const listener of this.listeners.onProbeComplete) {
                listener(result);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            for (const listener of this.listeners.onProbeError) {
                listener(error, target);
            }
        }
    }
}

// helper q cria o agendador embaladinho pra uso
export function createScheduler(config: SchedulerConfig): ProbeScheduler {
    return new ProbeScheduler(config);
}
