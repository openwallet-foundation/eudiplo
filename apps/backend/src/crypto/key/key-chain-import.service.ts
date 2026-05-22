import { readFileSync } from "node:fs";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { plainToClass } from "class-transformer";
import type { JWK } from "jose";
import { Repository } from "typeorm";
import { v4 } from "uuid";
import { TenantEntity } from "../../auth/tenant/entitites/tenant.entity";
import {
    ConfigImportOrchestratorService,
    ImportPhase,
} from "../../shared/utils/config-import/config-import-orchestrator.service";
import { ConfigImportService } from "../../shared/utils/config-import/config-import.service";
import { CertificateBuilderService } from "./cert/certificate-builder.service";
import { KeyChainImportDto } from "./dto/key-chain-import.dto";
import { KeyChainEntity, KeyUsage } from "./entities/key-chain.entity";
import type { KmsAdapter, KmsKeyRef } from "./kms/kms-adapter";
import { KmsProviderRegistry } from "./kms/kms-provider.registry";

/**
 * Handles config-driven key-chain import and the config-import lifecycle hook.
 *
 * Keeps import logic isolated from the CRUD and signing concerns in
 * {@link KeyChainService} and {@link KeyChainSigningService}.
 */
@Injectable()
export class KeyChainImportService {
    private readonly logger = new Logger(KeyChainImportService.name);

    constructor(
        @InjectRepository(KeyChainEntity)
        private readonly keyChainRepository: Repository<KeyChainEntity>,
        @InjectRepository(TenantEntity)
        private readonly tenantRepository: Repository<TenantEntity>,
        private readonly configService: ConfigService,
        private readonly configImportService: ConfigImportService,
        private readonly kmsRegistry: KmsProviderRegistry,
        private readonly certBuilder: CertificateBuilderService,
        configImportOrchestrator: ConfigImportOrchestratorService,
    ) {
        configImportOrchestrator.register(
            "key-chains",
            ImportPhase.CORE,
            (tenantId) => this.importForTenant(tenantId),
        );
    }

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

    async importKeyChain(
        tenantId: string,
        dto: KeyChainImportDto,
    ): Promise<string> {
        const id = dto.id || v4();
        const tenant = await this.tenantRepository.findOneByOrFail({
            id: tenantId,
        });
        const hostname = this.getHostname();

        const privateKey: JWK = { ...dto.key };
        if (!privateKey.kid) {
            privateKey.kid = `${id}-active`;
        }
        if (!privateKey.alg) {
            privateKey.alg = "ES256";
        }

        const adapter = this.kmsRegistry.resolve(dto.kmsProvider);

        if (dto.rotationPolicy?.enabled) {
            return this.importKeyChainWithRotation(
                id,
                tenantId,
                tenant.name,
                hostname,
                privateKey,
                adapter,
                dto,
            );
        }

        const activeMat = await adapter.importKey({
            kid: privateKey.kid,
            privateJwk: privateKey,
        });

        let activeCertificate: string;
        if (dto.crt && dto.crt.length > 0) {
            activeCertificate = dto.crt.join("\n");
        } else {
            const now = new Date();
            const notAfter = new Date(
                now.getTime() + 365 * 24 * 60 * 60 * 1000,
            );
            activeCertificate = await this.certBuilder.createSelfSignedCert(
                adapter,
                activeMat.ref,
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
            kmsProvider: adapter.providerId,
            activeJwk: this.storedKeyForEntity(adapter, activeMat.ref),
            activeCertificate,
            externalKeyId: activeMat.ref.externalKeyId,
            rotationEnabled: false,
        });

        this.logger.log(
            `Imported key chain ${id} for tenant ${tenantId} (usage: ${dto.usageType}, provider: ${adapter.providerId})`,
        );
        return id;
    }

    private async importKeyChainWithRotation(
        id: string,
        tenantId: string,
        subjectCN: string,
        hostname: string,
        rootKeyJwk: JWK,
        adapter: KmsAdapter,
        dto: KeyChainImportDto,
    ): Promise<string> {
        const now = new Date();
        const certValidityDays = dto.rotationPolicy?.certValidityDays || 365;
        const rotationIntervalDays = dto.rotationPolicy?.intervalDays || 90;
        const notAfter = new Date(
            now.getTime() + certValidityDays * 24 * 60 * 60 * 1000,
        );

        rootKeyJwk.kid = rootKeyJwk.kid || `${id}-root`;
        const rootMat = await adapter.importKey({
            kid: rootKeyJwk.kid,
            privateJwk: rootKeyJwk,
        });

        let rootCertificate: string;
        if (dto.crt && dto.crt.length > 0) {
            rootCertificate = dto.crt[0];
        } else {
            const rootNotAfter = new Date(
                now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000,
            );
            rootCertificate = await this.certBuilder.createSelfSignedCaCert(
                adapter,
                rootMat.ref,
                `${subjectCN} Root CA`,
                hostname,
                now,
                rootNotAfter,
            );
        }

        const activeMat = await adapter.generateKey({
            kid: `${id}-active-${Date.now()}`,
        });
        const { chain } = await this.certBuilder.createCaSignedCert({
            caAdapter: adapter,
            caRef: rootMat.ref,
            caCertPem: rootCertificate,
            subjectPublicJwk: activeMat.ref.publicJwk,
            subjectCN,
            hostname,
            notBefore: now,
            notAfter,
        });

        await this.keyChainRepository.save({
            id,
            tenantId,
            usageType: dto.usageType,
            usage: KeyUsage.Sign,
            description: dto.description,
            kmsProvider: adapter.providerId,
            rootJwk: this.storedKeyForEntity(adapter, rootMat.ref),
            rootCertificate,
            activeJwk: this.storedKeyForEntity(adapter, activeMat.ref),
            activeCertificate: chain.join("\n"),
            externalKeyId: activeMat.ref.externalKeyId,
            rotationEnabled: true,
            rotationIntervalDays,
            certValidityDays,
        });

        this.logger.log(
            `Imported key chain ${id} with rotation for tenant ${tenantId} (usage: ${dto.usageType}, provider: ${adapter.providerId})`,
        );
        return id;
    }

    /**
     * What gets persisted into the entity's JWK columns.
     * For `db` we keep the full private JWK; for external providers only the public JWK.
     */
    private storedKeyForEntity(adapter: KmsAdapter, ref: KmsKeyRef): JWK {
        if (adapter.type === "db" && ref.privateJwk) {
            return ref.privateJwk;
        }
        return ref.publicJwk;
    }

    private getHostname(): string {
        return new URL(this.configService.getOrThrow<string>("PUBLIC_URL"))
            .hostname;
    }
}
