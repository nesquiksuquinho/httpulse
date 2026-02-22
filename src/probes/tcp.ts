import { connect, type Socket } from "node:net";

// o retorno maroto do scan tcp
export interface TcpProbeResult {

    connected: boolean;

    connectTime: number;

    host: string;

    port: number;

    error: string | null;
}

const TCP_TIMEOUT = 5000;

// tenta ligar a tomada na porta e ver se rola conexao (bem direto)
export function tcpProbe(
    host: string,
    port: number,
    timeout = TCP_TIMEOUT,
): Promise<TcpProbeResult> {
    return new Promise((resolve) => {
        const start = performance.now();
        let socket: Socket | null = null;

        const cleanup = () => {
            if (socket) {
                socket.removeAllListeners();
                socket.destroy();
                socket = null;
            }
        };

        try {
            socket = connect({ host, port, timeout }, () => {
                const connectTime = Math.round((performance.now() - start) * 100) / 100;
                cleanup();
                resolve({
                    connected: true,
                    connectTime,
                    host,
                    port,
                    error: null,
                });
            });

            socket.on("error", (err) => {
                const connectTime = Math.round((performance.now() - start) * 100) / 100;
                cleanup();
                resolve({
                    connected: false,
                    connectTime,
                    host,
                    port,
                    error: err.message,
                });
            });

            socket.on("timeout", () => {
                const connectTime = Math.round((performance.now() - start) * 100) / 100;
                cleanup();
                resolve({
                    connected: false,
                    connectTime,
                    host,
                    port,
                    error: "Tempo de conexão esgotado",
                });
            });
        } catch (err) {
            const connectTime = Math.round((performance.now() - start) * 100) / 100;
            cleanup();
            resolve({
                connected: false,
                connectTime,
                host,
                port,
                error: err instanceof Error ? err.message : String(err),
            });
        }
    });
}

// escaneia um monte de porta duma vez pra ver o que ta de perna aberta no servidor
export async function tcpProbePorts(
    host: string,
    ports: number[],
    timeout?: number,
): Promise<TcpProbeResult[]> {
    return Promise.all(ports.map((port) => tcpProbe(host, port, timeout)));
}
