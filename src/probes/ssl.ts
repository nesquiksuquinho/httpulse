import type { CertificateInfo } from "../core/types.js";
import { connect } from "node:tls";

const SSL_TIMEOUT = 5000;

// faltando um mes a gente ja comeca a avisar q vai dar ruim
export const CERT_EXPIRY_WARNING_DAYS = 30;

// faltando uma semana a gente ja bota tudo em alerta vermelho
export const CERT_EXPIRY_CRITICAL_DAYS = 7;

// conecta na brutaleza na 443, arranca o certificado ssl e fofoca tudo pra gnt
export function sslProbe(hostname: string, port = 443): Promise<CertificateInfo | null> {
    return new Promise((resolve) => {
        try {
            const socket = connect(
                {
                    host: hostname,
                    port,
                    servername: hostname,
                    rejectUnauthorized: false,
                    timeout: SSL_TIMEOUT,
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

// checa se o certificado ta suavao, expirando logo ou se ja ta morto e fedendo
export function evaluateCertHealth(
    cert: CertificateInfo,
): "healthy" | "warning" | "critical" | "expired" {
    if (!cert.isValid) return "expired";
    if (cert.daysUntilExpiry <= 0) return "expired";
    if (cert.daysUntilExpiry <= CERT_EXPIRY_CRITICAL_DAYS) return "critical";
    if (cert.daysUntilExpiry <= CERT_EXPIRY_WARNING_DAYS) return "warning";
    return "healthy";
}
