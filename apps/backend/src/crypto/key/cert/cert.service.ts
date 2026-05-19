import { createHash } from "node:crypto";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as x509 from "@peculiar/x509";
import { KeyChainEntity, KeyUsageType } from "../entities/key-chain.entity";
import { KeyChainService } from "../key-chain.service";
import { CrlValidationService } from "./crl-validation.service";

export interface FindCertOptions {
    tenantId: string;
    type: KeyUsageType;
    /**
     * Optional key chain ID to find a specific key chain.
     * @deprecated Use `keyId` instead.
     */
    certId?: string;
    /**
     * Optional key chain ID to find a specific key chain.
     */
    keyId?: string;
    /**
     * Optional fallback usage type. If no key chain is found for the
     * primary `type`, a second lookup using this type is attempted.
     */
    fallbackType?: KeyUsageType;
    /**
     * Skip certificate validation (expiry and CRL check).
     * Default: false
     */
    skipValidation?: boolean;
}

/**
 * Result of certificate validation.
 */
export interface CertValidationResult {
    /** Whether the certificate passed all validations */
    isValid: boolean;
    /** Error message if validation failed */
    error?: string;
    /** Whether the certificate is expired */
    isExpired?: boolean;
    /** Whether the certificate is revoked */
    isRevoked?: boolean;
    /** Certificate expiry date */
    expiresAt?: Date;
    /** Certificate validity start date */
    validFrom?: Date;
}

/**
 * Virtual certificate entity for backward compatibility.
 * Maps KeyChainEntity data to the old CertEntity interface.
 */
export interface CertificateInfo {
    id: string;
    tenantId: string;
    crt: string[];
    description?: string;
    keyId: string;
    keyChain: KeyChainEntity;
}

/**
 * Service for managing certificates.
 *
 * In the new unified model, certificates are stored directly in KeyChainEntity
 * (activeCertificate, rootCertificate, previousCertificate).
 * This service provides a compatibility layer for existing consumers.
 */
@Injectable()
export class CertService {
    private readonly logger = new Logger(CertService.name);

    constructor(
        private readonly keyChainService: KeyChainService,
        private readonly configService: ConfigService,
        private readonly crlValidationService?: CrlValidationService,
    ) {}

    /**
     * Find a certificate by type (usage type).
     * Returns the certificate from the matching key chain.
     */
    async find(options: FindCertOptions): Promise<CertificateInfo> {
        const { tenantId, type, skipValidation, fallbackType } = options;
        // Support both certId (deprecated) and keyId
        const keyId = options.keyId || options.certId;

        const keyChain = await this.keyChainService.findByUsageType(
            tenantId,
            type,
            keyId,
            fallbackType,
        );

        // Parse the certificate PEM to extract chain
        const certChain = this.parseCertificateChain(
            keyChain.activeCertificate,
        );

        const certInfo: CertificateInfo = {
            id: keyChain.id,
            tenantId,
            crt: certChain,
            description: keyChain.description,
            keyId: keyChain.id,
            keyChain,
        };

        if (!skipValidation) {
            const validation = await this.validateCertificate(certInfo);
            if (!validation.isValid) {
                throw new NotFoundException(
                    `Certificate validation failed: ${validation.error}`,
                );
            }
        }

        return certInfo;
    }

    /**
     * Find or create a certificate for a key chain.
     * In the new model, certificates are always created with the key chain,
     * so this just returns the existing one.
     */
    async findOrCreate(options: FindCertOptions): Promise<CertificateInfo> {
        return this.find(options);
    }

    /**
     * Get a certificate by ID (key chain ID).
     */
    async getCertificateById(
        tenantId: string,
        certId: string,
    ): Promise<CertificateInfo> {
        const keyChain = await this.keyChainService.getEntity(tenantId, certId);
        const certChain = this.parseCertificateChain(
            keyChain.activeCertificate,
        );

        return {
            id: keyChain.id,
            tenantId,
            crt: certChain,
            description: keyChain.description,
            keyId: keyChain.id,
            keyChain,
        };
    }

    /**
     * Get the certificate chain as an array of base64-encoded DER certificates.
     * Used for the x5c header in JWTs.
     */
    getCertChain(cert: CertificateInfo): string[] {
        return cert.crt.map((pem) => {
            try {
                const x509Cert = new x509.X509Certificate(pem);
                // Convert raw DER bytes to base64 (not base64url)
                return Buffer.from(x509Cert.rawData).toString("base64");
            } catch {
                // If parsing fails, try to extract base64 from PEM directly
                const base64 = pem
                    .replace("-----BEGIN CERTIFICATE-----", "")
                    .replace("-----END CERTIFICATE-----", "")
                    .replace(/\s/g, "");
                return base64;
            }
        });
    }

    /**
     * Get only the leaf (signing) certificate as a base64-encoded DER certificate array.
     * Used for x5c headers where only the signing certificate should be included (e.g., status lists).
     */
    getLeafCertBase64(cert: CertificateInfo): string[] {
        const leafPem = cert.crt[0];
        try {
            const x509Cert = new x509.X509Certificate(leafPem);
            return [Buffer.from(x509Cert.rawData).toString("base64")];
        } catch {
            const base64 = leafPem
                .replace("-----BEGIN CERTIFICATE-----", "")
                .replace("-----END CERTIFICATE-----", "")
                .replace(/\s/g, "");
            return [base64];
        }
    }

    /**
     * Validate a certificate for expiry and revocation.
     */
    async validateCertificate(
        cert: CertificateInfo,
    ): Promise<CertValidationResult> {
        try {
            const leafPem = cert.crt[0];
            const x509Cert = new x509.X509Certificate(leafPem);
            const now = new Date();

            // Check expiry
            if (x509Cert.notAfter < now) {
                return {
                    isValid: false,
                    isExpired: true,
                    error: `Certificate expired on ${x509Cert.notAfter.toISOString()}`,
                    expiresAt: x509Cert.notAfter,
                    validFrom: x509Cert.notBefore,
                };
            }

            // Check CRL revocation if service is available
            if (this.crlValidationService) {
                const crlResult =
                    await this.crlValidationService.checkCertificateRevocation(
                        leafPem,
                    );
                if (!crlResult.isValid && crlResult.revokedAt) {
                    return {
                        isValid: false,
                        isRevoked: true,
                        error:
                            crlResult.reason || "Certificate has been revoked",
                        expiresAt: x509Cert.notAfter,
                        validFrom: x509Cert.notBefore,
                    };
                }
            }

            return {
                isValid: true,
                expiresAt: x509Cert.notAfter,
                validFrom: x509Cert.notBefore,
            };
        } catch (error: any) {
            return {
                isValid: false,
                error: `Failed to validate certificate: ${error.message}`,
            };
        }
    }

    /**
     * Get the hostname from the PUBLIC_URL config.
     */
    private getHostname(): string {
        return new URL(this.configService.getOrThrow<string>("PUBLIC_URL"))
            .hostname;
    }

    /**
     * Add an external certificate to an existing key chain.
     * Used for storing certificates obtained from external sources (e.g., registrar).
     */
    async addCertificate(
        tenantId: string,
        options: {
            crt: string[];
            keyId: string;
            description?: string;
        },
    ): Promise<string> {
        const { crt, keyId, description } = options;

        // Get the existing key chain
        const keyChain = await this.keyChainService.getEntity(tenantId, keyId);

        // Update the key chain with the new certificate
        await this.keyChainService.update(tenantId, keyId, {
            activeCertificate: crt.join("\n"),
            description: description || keyChain.description,
        });

        this.logger.log(
            `[${tenantId}] Added certificate to key chain ${keyId}`,
        );

        return keyId;
    }

    /**
     * Parse a PEM certificate chain into an array of PEM strings.
     */
    private parseCertificateChain(pemChain: string): string[] {
        const certs: string[] = [];
        const certRegex =
            /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g;
        let match;

        while ((match = certRegex.exec(pemChain)) !== null) {
            certs.push(match[0]);
        }

        // If no certificates found, treat the whole string as one cert
        if (certs.length === 0 && pemChain.includes("CERTIFICATE")) {
            certs.push(pemChain);
        }

        return certs;
    }

    /**
     * Compute the SHA-256 hash of the leaf certificate (for x509_hash client_id).
     * Returns the hash as a base64url-encoded string.
     */
    getCertHash(cert: CertificateInfo): string {
        const leafPem = cert.crt[0];
        const x509Cert = new x509.X509Certificate(leafPem);
        const hash = createHash("sha256")
            .update(Buffer.from(x509Cert.rawData))
            .digest();
        // Return as base64url (no padding)
        return hash
            .toString("base64")
            .replaceAll("+", "-")
            .replaceAll("/", "_")
            .replace(/=+$/, "");
    }
}
