import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import * as x509 from "@peculiar/x509";
import { Signer } from "@sd-jwt/types";
import { plainToClass } from "class-transformer";
import {
    exportJWK,
    exportSPKI,
    generateKeyPair,
    importJWK,
    JWK,
    JWSHeaderParameters,
    JWTPayload,
    SignJWT,
} from "jose";
import { Span } from "nestjs-otel";
import { Repository } from "typeorm";
import { v4 } from "uuid";
import { TenantEntity } from "../../auth/tenant/entitites/tenant.entity";
import { ConfigImportService } from "../../shared/utils/config-import/config-import.service";
import {
    ConfigImportOrchestratorService,
    ImportPhase,
} from "../../shared/utils/config-import/config-import-orchestrator.service";
import { KeyChainCreateDto, KeyChainType } from "./dto/key-chain-create.dto";
import { KeyChainExportDto } from "./dto/key-chain-export.dto";
import { KeyChainImportDto } from "./dto/key-chain-import.dto";
import {
    CertificateInfoDto,
    KeyChainResponseDto,
    PublicKeyInfoDto,
} from "./dto/key-chain-response.dto";
import { KeyChainUpdateDto } from "./dto/key-chain-update.dto";
import { KmsConfigDto, KmsProviderType } from "./dto/kms-config.dto";
import {
    KmsProviderCapabilitiesDto,
    KmsProviderInfoDto,
} from "./dto/kms-provider-capabilities.dto";
import { KmsProvidersResponseDto } from "./dto/kms-providers-response.dto";
import {
    KeyChainEntity,
    KeyUsage,
    KeyUsageType,
} from "./entities/key-chain.entity";

const ECDSA_P256 = {
    name: "ECDSA",
    namedCurve: "P-256",
    hash: "SHA-256" as const,
};

/**
 * KeyChainService manages the unified key chain model.
 *
 * A key chain encapsulates:
 * - An optional root CA key (for internal certificate chains)
 * - An active signing key with its certificate
 * - A previous key (for grace period after rotation)
 * - Rotation policy
 */
@Injectable()
export class KeyChainService {
    private readonly logger = new Logger(KeyChainService.name);

    constructor(
        @InjectRepository(KeyChainEntity)
        private readonly keyChainRepository: Repository<KeyChainEntity>,
        @InjectRepository(TenantEntity)
        private readonly tenantRepository: Repository<TenantEntity>,
        private readonly configService: ConfigService,
        private readonly configImportService: ConfigImportService,
        configImportOrchestrator: ConfigImportOrchestratorService,
    ) {
        configImportOrchestrator.register(
            "key-chains",
            ImportPhase.CORE,
            (tenantId) => this.importForTenant(tenantId),
        );
    }

    /**
     * Get available KMS providers and their capabilities.
     *
     * Reads the kms.json config file to determine which providers are configured.
     * If no config file exists, returns the default 'db' provider.
     */
    getProviders(): KmsProvidersResponseDto {
        const configFolder = this.configService.get<string>("CONFIG_FOLDER");
        const kmsConfigPath = configFolder
            ? join(configFolder, "kms.json")
            : null;

        // Default configuration if no kms.json exists
        const defaultConfig: KmsConfigDto = {
            defaultProvider: "db",
            providers: [
                {
                    id: "db",
                    type: "db",
                    description: "Default database provider",
                },
            ],
        };

        let config = defaultConfig;

        if (kmsConfigPath && existsSync(kmsConfigPath)) {
            try {
                const raw = readFileSync(kmsConfigPath, "utf8");
                config = JSON.parse(raw) as KmsConfigDto;
            } catch (error) {
                this.logger.warn(
                    `Failed to read kms.json, using default config: ${error}`,
                );
            }
        }

        // Map providers to response DTOs with capabilities
        const providers: KmsProviderInfoDto[] = config.providers.map((p) => ({
            name: p.id,
            type: p.type,
            description: p.description,
            capabilities: this.getCapabilitiesForType(p.type),
        }));

        return {
            providers,
            default: config.defaultProvider || "db",
        };
    }

    /**
     * Get capabilities for a KMS provider type.
     */
    private getCapabilitiesForType(
        type: KmsProviderType,
    ): KmsProviderCapabilitiesDto {
        switch (type) {
            case "db":
                return {
                    canImport: true,
                    canCreate: true,
                    canDelete: true,
                };
            case "vault":
                return {
                    canImport: true,
                    canCreate: true,
                    canDelete: true,
                };
            case "aws-kms":
                return {
                    canImport: false,
                    canCreate: true,
                    canDelete: false,
                };
            default:
                return {
                    canImport: false,
                    canCreate: false,
                    canDelete: false,
                };
        }
    }

    /**
     * Create a new key chain.
     */
    async create(tenantId: string, dto: KeyChainCreateDto): Promise<string> {
        const id = v4();
        const tenant = await this.tenantRepository.findOneByOrFail({
            id: tenantId,
        });
        const hostname = this.getHostname();
        const subjectCN = tenant.name;

        const now = new Date();
        const certValidityDays = dto.rotationPolicy?.certValidityDays || 365;
        const notAfter = new Date(
            now.getTime() + certValidityDays * 24 * 60 * 60 * 1000,
        );

        let keyChain: Partial<KeyChainEntity>;

        if (dto.type === KeyChainType.InternalChain) {
            keyChain = await this.createInternalChain(
                id,
                tenantId,
                subjectCN,
                hostname,
                now,
                notAfter,
                dto,
            );
        } else {
            keyChain = await this.createStandaloneKey(
                id,
                tenantId,
                subjectCN,
                hostname,
                now,
                notAfter,
                dto,
            );
        }

        // Save the key chain
        await this.keyChainRepository.save({
            ...keyChain,
            id,
            tenantId,
            usageType: dto.usageType,
            usage: KeyUsage.Sign,
            description: dto.description,
            kmsProvider: dto.kmsProvider || "db",
            rotationEnabled: dto.rotationPolicy?.enabled ?? false,
            rotationIntervalDays: dto.rotationPolicy?.intervalDays,
            certValidityDays: dto.rotationPolicy?.certValidityDays,
        } as KeyChainEntity);

        this.logger.log(
            `Created key chain ${id} for tenant ${tenantId} (type: ${dto.type})`,
        );
        return id;
    }

    /**
     * Create a standalone key chain with a pre-generated private key.
     * Used for encryption keys (e.g., ECDH-ES) that don't need certificates.
     */
    async createStandalone(options: {
        tenantId: string;
        description?: string;
        usageType: KeyUsageType;
        privateKey: JWK;
    }): Promise<string> {
        const id = v4();
        const { tenantId, privateKey, usageType, description } = options;

        // Ensure the private key has a kid
        if (!privateKey.kid) {
            privateKey.kid = `${id}-active`;
        }

        await this.keyChainRepository.save({
            id,
            tenantId,
            usageType,
            usage: KeyUsage.Encrypt,
            description: description || "Encryption key",
            kmsProvider: "db",
            activeKey: privateKey,
            activeCertificate: "", // No certificate for encryption keys
            rotationEnabled: false,
        } as KeyChainEntity);

        this.logger.log(
            `Created standalone key chain ${id} for tenant ${tenantId}`,
        );
        return id;
    }

    /**
     * Create an internal chain with root CA + signing key.
     */
    private async createInternalChain(
        id: string,
        tenantId: string,
        subjectCN: string,
        hostname: string,
        notBefore: Date,
        notAfter: Date,
        dto: KeyChainCreateDto,
    ): Promise<Partial<KeyChainEntity>> {
        // === 1. Generate root CA key pair ===
        const rootKeyPair = await generateKeyPair("ES256", {
            extractable: true,
        });
        const rootPrivateJwk = await exportJWK(rootKeyPair.privateKey);
        rootPrivateJwk.kid = `${id}-root`;

        // Root CA validity is 10 years (never rotates)
        const rootNotAfter = new Date(
            notBefore.getTime() + 10 * 365 * 24 * 60 * 60 * 1000,
        );

        // === 2. Create self-signed root CA certificate ===
        const rootCertificate = await this.createSelfSignedCaCert(
            rootKeyPair,
            `${subjectCN} Root CA`,
            hostname,
            notBefore,
            rootNotAfter,
        );

        // === 3. Generate active signing key pair ===
        const activeKeyPair = await generateKeyPair("ES256", {
            extractable: true,
        });
        const activePrivateJwk = await exportJWK(activeKeyPair.privateKey);
        activePrivateJwk.kid = `${id}-active`;

        // === 4. Create CA-signed certificate for signing key ===
        const { chain } = await this.createCaSignedCert(
            rootKeyPair,
            rootCertificate,
            activeKeyPair.publicKey,
            subjectCN,
            hostname,
            notBefore,
            notAfter,
        );

        return {
            rootKey: rootPrivateJwk,
            rootCertificate,
            activeKey: activePrivateJwk,
            activeCertificate: chain.join("\n"), // Leaf + CA chain
        };
    }

    /**
     * Create a standalone key with self-signed certificate.
     */
    private async createStandaloneKey(
        id: string,
        tenantId: string,
        subjectCN: string,
        hostname: string,
        notBefore: Date,
        notAfter: Date,
        dto: KeyChainCreateDto,
    ): Promise<Partial<KeyChainEntity>> {
        // === Generate key pair ===
        const keyPair = await generateKeyPair("ES256", { extractable: true });
        const privateJwk = await exportJWK(keyPair.privateKey);
        privateJwk.kid = `${id}-active`;

        // === Create self-signed certificate ===
        const certificate = await this.createSelfSignedCert(
            keyPair,
            subjectCN,
            hostname,
            notBefore,
            notAfter,
        );

        return {
            activeKey: privateJwk,
            activeCertificate: certificate,
        };
    }

    /**
     * Create a self-signed CA certificate.
     */
    private async createSelfSignedCaCert(
        keyPair: CryptoKeyPair,
        subjectCN: string,
        hostname: string,
        notBefore: Date,
        notAfter: Date,
    ): Promise<string> {
        const cert = await x509.X509CertificateGenerator.createSelfSigned({
            serialNumber: "01",
            name: `C=DE, CN=${subjectCN}`,
            notBefore,
            notAfter,
            signingAlgorithm: ECDSA_P256,
            keys: keyPair,
            extensions: [
                new x509.SubjectAlternativeNameExtension([
                    { type: "dns", value: hostname },
                ]),
                new x509.BasicConstraintsExtension(true, undefined, true), // CA:TRUE, critical
                new x509.KeyUsagesExtension(
                    x509.KeyUsageFlags.digitalSignature |
                        x509.KeyUsageFlags.keyEncipherment |
                        x509.KeyUsageFlags.keyCertSign,
                    true,
                ),
                await x509.SubjectKeyIdentifierExtension.create(
                    keyPair.publicKey,
                ),
            ],
        });

        return cert.toString("pem");
    }

    /**
     * Create a self-signed end-entity certificate (not a CA).
     */
    private async createSelfSignedCert(
        keyPair: CryptoKeyPair,
        subjectCN: string,
        hostname: string,
        notBefore: Date,
        notAfter: Date,
    ): Promise<string> {
        const cert = await x509.X509CertificateGenerator.createSelfSigned({
            serialNumber: this.generateSerialNumber(),
            name: `C=DE, CN=${subjectCN}`,
            notBefore,
            notAfter,
            signingAlgorithm: ECDSA_P256,
            keys: keyPair,
            extensions: [
                new x509.SubjectAlternativeNameExtension([
                    { type: "dns", value: hostname },
                ]),
                new x509.BasicConstraintsExtension(false, undefined, true), // Not a CA
                new x509.KeyUsagesExtension(
                    x509.KeyUsageFlags.digitalSignature |
                        x509.KeyUsageFlags.keyEncipherment,
                    true,
                ),
                await x509.SubjectKeyIdentifierExtension.create(
                    keyPair.publicKey,
                ),
            ],
        });

        return cert.toString("pem");
    }

    /**
     * Create a certificate signed by a CA.
     */
    private async createCaSignedCert(
        caKeyPair: CryptoKeyPair,
        caCertPem: string,
        subjectPublicKey: CryptoKey,
        subjectCN: string,
        hostname: string,
        notBefore: Date,
        notAfter: Date,
    ): Promise<{ cert: string; chain: string[] }> {
        const caCert = new x509.X509Certificate(caCertPem);
        const issuerName = caCert.subject;

        const cert = await x509.X509CertificateGenerator.create({
            serialNumber: this.generateSerialNumber(),
            subject: `C=DE, CN=${subjectCN}`,
            issuer: issuerName,
            notBefore,
            notAfter,
            signingAlgorithm: ECDSA_P256,
            publicKey: subjectPublicKey,
            signingKey: caKeyPair.privateKey,
            extensions: [
                new x509.SubjectAlternativeNameExtension([
                    { type: "dns", value: hostname },
                ]),
                new x509.BasicConstraintsExtension(false, undefined, true), // Not a CA
                new x509.KeyUsagesExtension(
                    x509.KeyUsageFlags.digitalSignature |
                        x509.KeyUsageFlags.keyEncipherment,
                    true,
                ),
                await x509.SubjectKeyIdentifierExtension.create(
                    subjectPublicKey,
                ),
                await x509.AuthorityKeyIdentifierExtension.create(
                    caKeyPair.publicKey,
                ),
            ],
        });

        const certPem = cert.toString("pem");
        return {
            cert: certPem,
            chain: [certPem, caCertPem],
        };
    }

    /**
     * Get all key chains for a tenant.
     */
    async getAll(
        tenantId: string,
        usageType?: KeyUsageType,
    ): Promise<KeyChainResponseDto[]> {
        const keyChains = await this.keyChainRepository.find({
            where: { tenantId, ...(usageType ? { usageType } : {}) },
        });

        return keyChains.map((kc) => this.toResponseDto(kc));
    }

    /**
     * Get a specific key chain by ID.
     */
    async getById(tenantId: string, id: string): Promise<KeyChainResponseDto> {
        const keyChain = await this.keyChainRepository.findOne({
            where: { tenantId, id },
        });

        if (!keyChain) {
            throw new NotFoundException(`Key chain ${id} not found`);
        }

        return this.toResponseDto(keyChain);
    }

    /**
     * Export a key chain in config-import-compatible format.
     * Includes private key material so the output can be saved as a JSON config file.
     */
    async export(tenantId: string, id: string): Promise<KeyChainExportDto> {
        const keyChain = await this.getEntity(tenantId, id);

        const exportDto: KeyChainExportDto = {
            id: keyChain.id,
            description: keyChain.description,
            usageType: keyChain.usageType,
            key: keyChain.hasInternalCa()
                ? (keyChain.rootKey as KeyChainExportDto["key"])
                : (keyChain.activeKey as KeyChainExportDto["key"]),
            kmsProvider: keyChain.kmsProvider,
        };

        // Build certificate array.
        // For InternalChain: only export the root CA cert as crt[0].
        // The leaf cert is always regenerated on import, and including it would
        // cause importKeyChainWithRotation to treat it as the root CA cert (it
        // uses dto.crt[0] as rootCertificate).
        // For standalone: export the full activeCertificate chain.
        const certs: string[] = [];
        if (keyChain.hasInternalCa()) {
            if (keyChain.rootCertificate) {
                certs.push(keyChain.rootCertificate.trim());
            }
        } else if (keyChain.activeCertificate) {
            certs.push(...this.splitPemChain(keyChain.activeCertificate));
        }
        if (certs.length > 0) {
            exportDto.crt = certs;
        }

        // Include rotation policy if enabled
        if (keyChain.rotationEnabled) {
            exportDto.rotationPolicy = {
                enabled: true,
                intervalDays: keyChain.rotationIntervalDays,
                certValidityDays: keyChain.certValidityDays,
            };
        }

        return exportDto;
    }

    /**
     * Split a PEM chain (multiple certs joined by newlines) into individual PEM strings.
     */
    private splitPemChain(pem: string): string[] {
        const certs: string[] = [];
        const parts = pem.split("-----END CERTIFICATE-----");
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.includes("-----BEGIN CERTIFICATE-----")) {
                certs.push(`${trimmed}\n-----END CERTIFICATE-----`);
            }
        }
        return certs;
    }

    /**
     * Get a key chain entity by ID (internal use).
     */
    async getEntity(tenantId: string, id: string): Promise<KeyChainEntity> {
        const keyChain = await this.keyChainRepository.findOne({
            where: { tenantId, id },
        });

        if (!keyChain) {
            throw new NotFoundException(`Key chain ${id} not found`);
        }

        return keyChain;
    }

    /**
     * Find a key chain by usage type.
     * If a fallbackUsageType is provided and no key chain is found for
     * the primary type, a second lookup is performed with the fallback.
     * This enables attestation keys to also sign status lists when no
     * dedicated status-list key chain has been configured.
     */
    async findByUsageType(
        tenantId: string,
        usageType: KeyUsageType,
        keyId?: string,
        fallbackUsageType?: KeyUsageType,
    ): Promise<KeyChainEntity> {
        const whereClause: Record<string, unknown> = {
            tenantId,
            usageType,
        };

        if (keyId) {
            whereClause.id = keyId;
        }

        let keyChain = await this.keyChainRepository.findOne({
            where: whereClause,
        });

        if (!keyChain && fallbackUsageType) {
            const fallbackWhere: Record<string, unknown> = {
                tenantId,
                usageType: fallbackUsageType,
            };
            if (keyId) {
                fallbackWhere.id = keyId;
            }
            keyChain = await this.keyChainRepository.findOne({
                where: fallbackWhere,
            });
        }

        if (!keyChain) {
            const types = fallbackUsageType
                ? `'${usageType}' or '${fallbackUsageType}'`
                : `'${usageType}'`;
            throw new NotFoundException(
                `No key chain found with usage type ${types} for tenant ${tenantId}`,
            );
        }

        return keyChain;
    }

    /**
     * Update a key chain.
     */
    async update(
        tenantId: string,
        id: string,
        dto: KeyChainUpdateDto,
    ): Promise<void> {
        await this.getEntity(tenantId, id);

        const updates: Partial<KeyChainEntity> = {};

        if (dto.description !== undefined) {
            updates.description = dto.description;
        }

        if (dto.rotationPolicy) {
            if (dto.rotationPolicy.enabled !== undefined) {
                updates.rotationEnabled = dto.rotationPolicy.enabled;
            }
            if (dto.rotationPolicy.intervalDays !== undefined) {
                updates.rotationIntervalDays = dto.rotationPolicy.intervalDays;
            }
            if (dto.rotationPolicy.certValidityDays !== undefined) {
                updates.certValidityDays = dto.rotationPolicy.certValidityDays;
            }
        }

        if (dto.activeCertificate !== undefined) {
            updates.activeCertificate = dto.activeCertificate;
        }

        await this.keyChainRepository.update({ tenantId, id }, updates);
        this.logger.log(`Updated key chain ${id}`);
    }

    /**
     * Delete a key chain.
     */
    async delete(tenantId: string, id: string): Promise<void> {
        const result = await this.keyChainRepository.delete({ tenantId, id });

        if (result.affected === 0) {
            throw new NotFoundException(`Key chain ${id} not found`);
        }

        this.logger.log(`Deleted key chain ${id}`);
    }

    // ─────────────────────── config import ───────────────────────

    /**
     * Import key chains for a tenant from the filesystem.
     *
     * Supports two modes:
     * 1. New format: key-chains/*.json with combined key + cert
     * 2. Legacy format: keys/*.json + certs/*.json (separate files linked by keyId)
     */
    async importForTenant(tenantId: string): Promise<void> {
        await this.configImportService.importConfigsForTenant<KeyChainImportDto>(
            tenantId,
            {
                subfolder: "key-chains",
                fileExtension: ".json",
                validationClass: KeyChainImportDto,
                resourceType: "key-chain",
                loadData: (filePath) => {
                    const payload = JSON.parse(readFileSync(filePath, "utf8"));
                    return plainToClass(KeyChainImportDto, payload);
                },
                checkExists: async (tid, data) => {
                    // Check by matching public key coordinates
                    return await this.keyChainRepository
                        .count({
                            where: { tenantId: tid, id: data.id },
                        })
                        .then((count) => count > 0);
                },
                processItem: async (tid, config) => {
                    await this.importKeyChain(tid, config);
                },
            },
        );
    }

    /**
     * Import a single key chain from DTO.
     *
     * When rotationPolicy.enabled is true, the imported key becomes the root CA
     * and a new leaf key is generated for signing. This satisfies HAIP section 4.5.1
     * which requires credential signing certificates to NOT be self-signed.
     */
    async importKeyChain(
        tenantId: string,
        dto: KeyChainImportDto,
    ): Promise<string> {
        const id = dto.id || v4();
        const tenant = await this.tenantRepository.findOneByOrFail({
            id: tenantId,
        });
        const hostname = this.getHostname();

        // Ensure key has a kid
        const privateKey = { ...dto.key };
        if (!privateKey.kid) {
            privateKey.kid = `${id}-active`;
        }
        if (!privateKey.alg) {
            privateKey.alg = "ES256";
        }

        // Rotation enabled: imported key becomes root CA, generate new leaf key
        if (dto.rotationPolicy?.enabled) {
            return this.importKeyChainWithRotation(
                id,
                tenantId,
                tenant.name,
                hostname,
                privateKey,
                dto,
            );
        }

        // Standard import: imported key is the active signing key
        let activeCertificate: string;

        if (dto.crt && dto.crt.length > 0) {
            // Use provided certificate
            activeCertificate = dto.crt.join("\n");
        } else {
            // Generate self-signed certificate
            // Need to import both private and public keys separately
            const privateKeyObj = await importJWK(privateKey, "ES256");

            // Create public key JWK by removing the private component
            const publicKeyJwk = { ...privateKey };
            delete (publicKeyJwk as Record<string, unknown>).d;
            const publicKeyObj = await importJWK(publicKeyJwk, "ES256");

            const now = new Date();
            const notAfter = new Date(
                now.getTime() + 365 * 24 * 60 * 60 * 1000,
            );
            activeCertificate = await this.createSelfSignedCert(
                {
                    privateKey: privateKeyObj as CryptoKey,
                    publicKey: publicKeyObj as CryptoKey,
                },
                tenant.name,
                hostname,
                now,
                notAfter,
            );
        }

        await this.keyChainRepository.save({
            id,
            tenantId,
            usageType: dto.usageType,
            usage: KeyUsage.Sign,
            description: dto.description,
            kmsProvider: dto.kmsProvider || "db",
            activeKey: privateKey as JWK,
            activeCertificate,
            rotationEnabled: false,
        } as KeyChainEntity);

        this.logger.log(
            `Imported key chain ${id} for tenant ${tenantId} (usage: ${dto.usageType})`,
        );
        return id;
    }

    /**
     * Import key chain with rotation enabled.
     * The imported key becomes the root CA, and a new leaf key is generated.
     */
    private async importKeyChainWithRotation(
        id: string,
        tenantId: string,
        subjectCN: string,
        hostname: string,
        rootKeyJwk: JWK,
        dto: KeyChainImportDto,
    ): Promise<string> {
        const now = new Date();
        const certValidityDays = dto.rotationPolicy?.certValidityDays || 365;
        const rotationIntervalDays = dto.rotationPolicy?.intervalDays || 90;
        const notAfter = new Date(
            now.getTime() + certValidityDays * 24 * 60 * 60 * 1000,
        );

        // === 1. Set up root CA key ===
        rootKeyJwk.kid = rootKeyJwk.kid || `${id}-root`;
        const rootPrivateKey = (await importJWK(
            rootKeyJwk,
            "ES256",
        )) as CryptoKey;
        const rootPublicJwk = this.getPublicJwk(rootKeyJwk);
        const rootPublicKey = (await importJWK(
            rootPublicJwk,
            "ES256",
        )) as CryptoKey;

        // === 2. Get or generate root CA certificate ===
        let rootCertificate: string;

        if (dto.crt && dto.crt.length > 0) {
            // Use provided CA certificate
            rootCertificate = dto.crt[0];
        } else {
            // Generate self-signed CA certificate for the imported key
            const rootNotAfter = new Date(
                now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000,
            );
            rootCertificate = await this.createSelfSignedCaCert(
                { privateKey: rootPrivateKey, publicKey: rootPublicKey },
                `${subjectCN} Root CA`,
                hostname,
                now,
                rootNotAfter,
            );
        }

        // === 3. Generate new active signing key ===
        const activeKeyPair = await generateKeyPair("ES256", {
            extractable: true,
        });
        const activePrivateJwk = await exportJWK(activeKeyPair.privateKey);
        activePrivateJwk.kid = `${id}-active-${Date.now()}`;

        // === 4. Create CA-signed certificate for the signing key ===
        const { chain } = await this.createCaSignedCert(
            { privateKey: rootPrivateKey, publicKey: rootPublicKey },
            rootCertificate,
            activeKeyPair.publicKey,
            subjectCN,
            hostname,
            now,
            notAfter,
        );

        // === 5. Save key chain with internal CA structure ===
        await this.keyChainRepository.save({
            id,
            tenantId,
            usageType: dto.usageType,
            usage: KeyUsage.Sign,
            description: dto.description,
            kmsProvider: dto.kmsProvider || "db",
            rootKey: rootKeyJwk,
            rootCertificate,
            activeKey: activePrivateJwk,
            activeCertificate: chain.join("\n"),
            rotationEnabled: true,
            rotationIntervalDays,
            certValidityDays,
        } as KeyChainEntity);

        this.logger.log(
            `Imported key chain ${id} with rotation for tenant ${tenantId} (usage: ${dto.usageType})`,
        );
        return id;
    }

    /**
     * Rotate the signing key in a key chain.
     * Creates new key material and certificate, moves current to previous.
     */
    async rotate(tenantId: string, id: string): Promise<void> {
        const keyChain = await this.getEntity(tenantId, id);
        const hostname = this.getHostname();
        const tenant = await this.tenantRepository.findOneByOrFail({
            id: tenantId,
        });
        const subjectCN = tenant.name;

        const now = new Date();
        const certValidityDays = keyChain.certValidityDays || 365;
        const notAfter = new Date(
            now.getTime() + certValidityDays * 24 * 60 * 60 * 1000,
        );

        // Grace period: keep previous key for 30 days after rotation
        const gracePeriodDays = 30;
        const previousKeyExpiry = new Date(
            now.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000,
        );

        // Move current key to previous
        const previousKey = keyChain.activeKey;
        const previousCertificate = keyChain.activeCertificate;

        // Generate new active key
        const newKeyPair = await generateKeyPair("ES256", {
            extractable: true,
        });
        const newPrivateJwk = await exportJWK(newKeyPair.privateKey);
        newPrivateJwk.kid = `${id}-${Date.now()}`;

        let newCertificate: string;

        if (keyChain.hasInternalCa()) {
            // Recreate CA key pair from JWK for signing
            const caPrivateKey = (await importJWK(
                keyChain.rootKey!,
                "ES256",
            )) as CryptoKey;
            const caPublicJwk = this.getPublicJwk(keyChain.rootKey!);
            const caPublicKey = (await importJWK(
                caPublicJwk,
                "ES256",
            )) as CryptoKey;

            const { chain } = await this.createCaSignedCert(
                { privateKey: caPrivateKey, publicKey: caPublicKey },
                keyChain.rootCertificate!,
                newKeyPair.publicKey,
                subjectCN,
                hostname,
                now,
                notAfter,
            );
            newCertificate = chain.join("\n");
        } else {
            newCertificate = await this.createSelfSignedCert(
                newKeyPair,
                subjectCN,
                hostname,
                now,
                notAfter,
            );
        }

        // Update the key chain
        await this.keyChainRepository.update(
            { tenantId, id },
            {
                activeKey: newPrivateJwk,
                activeCertificate: newCertificate,
                previousKey,
                previousCertificate,
                previousKeyExpiry,
                lastRotatedAt: now,
            },
        );

        this.logger.log(`Rotated key chain ${id}`);
    }

    /**
     * Get the active private key (for signing operations).
     */
    async getActiveKey(tenantId: string, id: string): Promise<JWK> {
        const keyChain = await this.getEntity(tenantId, id);
        return keyChain.activeKey;
    }

    /**
     * Get all public keys for JWKS (current + previous if in grace period).
     */
    async getPublicKeys(tenantId: string, id: string): Promise<JWK[]> {
        const keyChain = await this.getEntity(tenantId, id);
        return keyChain.getPublicKeys();
    }

    /**
     * Get the active certificate chain as PEM.
     */
    async getActiveCertificate(tenantId: string, id: string): Promise<string> {
        const keyChain = await this.getEntity(tenantId, id);
        return keyChain.activeCertificate;
    }

    // ─────────────────────────────────────────────────────────
    // SIGNING OPERATIONS
    // ─────────────────────────────────────────────────────────

    /**
     * Get a Signer callback for SD-JWT signing.
     * If keyId is provided, uses that specific key chain.
     * Otherwise uses the first available key chain.
     */
    async signer(tenantId: string, keyId?: string): Promise<Signer> {
        const keyChain = keyId
            ? await this.getEntity(tenantId, keyId)
            : await this.getFirstKeyChain(tenantId);

        const privateKey = await importJWK(keyChain.activeKey, "ES256");

        return async (data: string): Promise<string> => {
            // For SD-JWT, sign raw data directly (not a full JWT)
            const encoder = new TextEncoder();
            const signature = await globalThis.crypto.subtle.sign(
                { name: "ECDSA", hash: "SHA-256" },
                privateKey as CryptoKey,
                encoder.encode(data),
            );
            return Buffer.from(signature).toString("base64url");
        };
    }

    /**
     * Sign a JWT with the active key of a key chain.
     */
    @Span("keychain.signJWT")
    async signJWT(
        payload: JWTPayload,
        header: JWSHeaderParameters,
        tenantId: string,
        keyId?: string,
    ): Promise<string> {
        const keyChain = keyId
            ? await this.getEntity(tenantId, keyId)
            : await this.getFirstKeyChain(tenantId);

        const privateKey = await importJWK(keyChain.activeKey, "ES256");

        // Build JWT header, filtering out incompatible properties
        const { b64, ...compatibleHeader } = header;
        const jwtHeader = {
            ...compatibleHeader,
            alg: header.alg || "ES256",
            kid: keyChain.activeKey.kid,
        };

        const jwt = new SignJWT(payload).setProtectedHeader(jwtHeader);

        return jwt.sign(privateKey);
    }

    /**
     * Get the public key for a key chain.
     * @param type - "jwk" for JSON Web Key format, "pem" for PEM format
     */
    getPublicKey(type: "jwk", tenantId: string, keyId?: string): Promise<JWK>;
    getPublicKey(
        type: "pem",
        tenantId: string,
        keyId?: string,
    ): Promise<string>;
    async getPublicKey(
        type: "pem" | "jwk",
        tenantId: string,
        keyId?: string,
    ): Promise<JWK | string> {
        const keyChain = keyId
            ? await this.getEntity(tenantId, keyId)
            : await this.getFirstKeyChain(tenantId);

        const publicJwk = this.getPublicJwk(keyChain.activeKey);

        if (type === "jwk") {
            return publicJwk;
        }

        const publicKey = await importJWK(publicJwk, "ES256");
        return exportSPKI(publicKey as CryptoKey);
    }

    /**
     * Get the Key ID (kid) for the first available key chain.
     */
    async getKid(tenantId: string): Promise<string> {
        const keyChain = await this.getFirstKeyChain(tenantId);
        return keyChain.id;
    }

    /**
     * Get the first available key chain for a tenant.
     */
    private async getFirstKeyChain(tenantId: string): Promise<KeyChainEntity> {
        const keyChain = await this.keyChainRepository.findOne({
            where: { tenantId },
        });

        if (!keyChain) {
            throw new NotFoundException(
                `No key chain found for tenant ${tenantId}`,
            );
        }

        return keyChain;
    }

    // ─────────────────────────────────────────────────────────
    // HELPER METHODS
    // ─────────────────────────────────────────────────────────

    private getHostname(): string {
        return new URL(this.configService.getOrThrow<string>("PUBLIC_URL"))
            .hostname;
    }

    private generateSerialNumber(): string {
        const bytes = new Uint8Array(16);
        globalThis.crypto.getRandomValues(bytes);
        return Buffer.from(bytes).toString("hex");
    }

    private getPublicJwk(jwk: JWK): JWK {
        const { d, p, q, dp, dq, qi, k, ...publicJwk } = jwk as Record<
            string,
            unknown
        >;
        return publicJwk as JWK;
    }

    private toResponseDto(keyChain: KeyChainEntity): KeyChainResponseDto {
        const type = keyChain.hasInternalCa()
            ? KeyChainType.InternalChain
            : KeyChainType.Standalone;

        const response: KeyChainResponseDto = {
            id: keyChain.id,
            usageType: keyChain.usageType,
            type,
            description: keyChain.description,
            kmsProvider: keyChain.kmsProvider,
            activePublicKey: this.toPublicKeyInfo(keyChain.activeKey),
            rotationPolicy: {
                enabled: keyChain.rotationEnabled,
                intervalDays: keyChain.rotationIntervalDays,
                certValidityDays: keyChain.certValidityDays,
                nextRotationAt: this.calculateNextRotation(keyChain),
            },
            createdAt: keyChain.createdAt,
            updatedAt: keyChain.updatedAt,
        };

        // Only include certificate info for keys that have certificates
        // Encryption keys (ECDH-ES) don't have certificates
        if (keyChain.activeCertificate) {
            response.activeCertificate = this.toCertificateInfo(
                keyChain.activeCertificate,
            );
        }

        if (keyChain.rootCertificate) {
            response.rootCertificate = this.toCertificateInfo(
                keyChain.rootCertificate,
            );
        }

        if (keyChain.previousKey) {
            response.previousPublicKey = this.toPublicKeyInfo(
                keyChain.previousKey,
            );
            response.previousCertificate = this.toCertificateInfo(
                keyChain.previousCertificate!,
            );
            response.previousKeyExpiry = keyChain.previousKeyExpiry;
        }

        return response;
    }

    private toPublicKeyInfo(jwk: JWK): PublicKeyInfoDto {
        const publicJwk = this.getPublicJwk(jwk);
        return {
            kty: publicJwk.kty as string,
            alg: publicJwk.alg as string | undefined,
            kid: publicJwk.kid as string | undefined,
            crv: (publicJwk as Record<string, unknown>).crv as
                | string
                | undefined,
        };
    }

    private toCertificateInfo(pem: string): CertificateInfoDto {
        // Parse first certificate in chain
        const firstCertPem =
            pem.split("-----END CERTIFICATE-----")[0] +
            "-----END CERTIFICATE-----";

        try {
            const cert = new x509.X509Certificate(firstCertPem);
            return {
                pem,
                subject: cert.subject,
                issuer: cert.issuer,
                notBefore: cert.notBefore,
                notAfter: cert.notAfter,
                serialNumber: cert.serialNumber,
            };
        } catch {
            return { pem };
        }
    }

    private calculateNextRotation(keyChain: KeyChainEntity): Date | undefined {
        if (!keyChain.rotationEnabled || !keyChain.rotationIntervalDays) {
            return undefined;
        }

        const baseDate = keyChain.lastRotatedAt || keyChain.createdAt;
        return new Date(
            baseDate.getTime() +
                keyChain.rotationIntervalDays * 24 * 60 * 60 * 1000,
        );
    }
}
