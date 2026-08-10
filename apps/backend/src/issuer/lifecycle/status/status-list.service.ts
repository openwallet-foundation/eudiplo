import { randomInt } from "node:crypto";
import {
    ConflictException,
    forwardRef,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import {
    BitsPerStatus,
    createHeaderAndPayload,
    JWTwithStatusListPayload,
    getListFromStatusListJWT,
    StatusList,
    StatusListCwt,
    StatusListJWTHeaderParameters,
} from "@owf/token-status-list";
import { JwtPayload } from "@sd-jwt/core";
import { SignatureAlgorithm } from "@owf/cose";
import { X509Certificate } from "@peculiar/x509";
import { decodeJwt } from "jose";
import { IsNull, Repository } from "typeorm";
import { v4 } from "uuid";
import { TenantEntity } from "../../../auth/tenant/entitites/tenant.entity";
import { CertService } from "../../../crypto/key/cert/cert.service";
import { KeyUsageType } from "../../../crypto/key/types/key-usage-type";
import { KeyChainService } from "../../../crypto/key/key-chain.service";
import { Session } from "../../../session/entities/session.entity";
import { ConfigImportService } from "../../../shared/utils/config-import/config-import.service";
import {
    ConfigImportOrchestratorService,
    ImportPhase,
} from "../../../shared/utils/config-import/config-import-orchestrator.service";
import { StatusListImportDto } from "./dto/status-list-import.dto";
import { StatusUpdateDto } from "./dto/status-update.dto";
import { StatusListEntity } from "./entities/status-list.entity";
import { StatusMapping } from "./entities/status-mapping.entity";
import { StatusListConfigService } from "./status-list-config.service";

@Injectable()
export class StatusListService {
    private readonly logger = new Logger(StatusListService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly certService: CertService,
        public readonly keyChainService: KeyChainService,
        @InjectRepository(StatusMapping)
        private readonly statusMappingRepository: Repository<StatusMapping>,
        @InjectRepository(StatusListEntity)
        private readonly statusListRepository: Repository<StatusListEntity>,
        @InjectRepository(TenantEntity)
        private readonly tenantRepository: Repository<TenantEntity>,
        private readonly configImportService: ConfigImportService,
        @Inject(forwardRef(() => StatusListConfigService))
        private readonly statusListConfigService: StatusListConfigService,
        readonly configImportOrchestrator: ConfigImportOrchestratorService,
    ) {
        configImportOrchestrator.register(
            "status-lists",
            ImportPhase.FINAL,
            (tenantId) => this.importForTenant(tenantId),
        );
    }

    private async getSigningCert(entry: StatusListEntity) {
        // Use the pinned key chain if specified, otherwise use the tenant's default status list key chain.
        // Falls back to attestation key chains when no dedicated status list key exists.
        const cert = entry.keyChainId
            ? await this.certService.find({
                  tenantId: entry.tenantId,
                  type: KeyUsageType.StatusList,
                  fallbackType: KeyUsageType.Attestation,
                  keyId: entry.keyChainId,
              })
            : await this.certService.find({
                  tenantId: entry.tenantId,
                  type: KeyUsageType.StatusList,
                  fallbackType: KeyUsageType.Attestation,
              });

        if (!cert) {
            throw new NotFoundException(
                `Key chain ${entry.keyChainId} not found for tenant ${entry.tenantId}`,
            );
        }

        return cert;
    }

    /**
     * Get the effective status list capacity for a tenant.
     */
    private async getEffectiveCapacity(tenantId: string): Promise<number> {
        const tenant = await this.tenantRepository.findOneBy({ id: tenantId });
        return (
            tenant?.statusListConfig?.capacity ??
            this.configService.getOrThrow<number>("STATUS_CAPACITY")
        );
    }

    /**
     * Get the effective bits per status for a tenant.
     */
    private async getEffectiveBits(tenantId: string): Promise<BitsPerStatus> {
        const tenant = await this.tenantRepository.findOneBy({ id: tenantId });
        return (
            tenant?.statusListConfig?.bits ??
            this.configService.getOrThrow<BitsPerStatus>("STATUS_BITS")
        );
    }

    /**
     * Cryptographically secure Fisher-Yates shuffle
     */
    private shuffleArray<T>(array: T[]): T[] {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = randomInt(0, i + 1);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Build the URI for a status list.
     */
    private buildStatusListUri(tenantId: string, listId: string): string {
        const baseUrl = this.configService.getOrThrow<string>("PUBLIC_URL");
        return `${baseUrl}/issuers/${tenantId}/status-management/status-list/${listId}`;
    }

    /**
     * Build the aggregation URI for a tenant.
     * This endpoint returns all status list URIs for the tenant.
     * See RFC draft-ietf-oauth-status-list Section 9.
     */
    private buildAggregationUri(tenantId: string): string {
        const baseUrl = this.configService.getOrThrow<string>("PUBLIC_URL");
        return `${baseUrl}/issuers/${tenantId}/status-management/status-list-aggregation`;
    }

    /**
     * Create a new status list, optionally bound to a specific credential configuration and/or certificate.
     * @param tenantId The tenant ID
     * @param options Optional configuration for the new list
     * @returns The created status list entity
     */
    async createNewList(
        tenantId: string,
        options?: {
            credentialConfigurationId?: string;
            keyChainId?: string;
            bits?: BitsPerStatus;
            capacity?: number;
        },
    ): Promise<StatusListEntity> {
        const size =
            options?.capacity ?? (await this.getEffectiveCapacity(tenantId));
        // create an empty array with the size
        const elements = new Array(size).fill(0).map(() => 0);
        // create a list of indexes and shuffle them using crypto-secure randomness
        const stack = this.shuffleArray(
            new Array(size).fill(0).map((_, i) => i),
        );

        const bits = options?.bits ?? (await this.getEffectiveBits(tenantId));

        // Validate keyChainId if provided
        if (options?.keyChainId) {
            const cert = await this.certService.find({
                tenantId,
                type: KeyUsageType.StatusList,
                fallbackType: KeyUsageType.Attestation,
                keyId: options.keyChainId,
            });
            if (!cert) {
                throw new NotFoundException(
                    `Key chain ${options.keyChainId} not found for tenant ${tenantId}`,
                );
            }
        }

        const entry = await this.statusListRepository.save({
            id: v4(),
            tenantId,
            credentialConfigurationId:
                options?.credentialConfigurationId ?? null,
            keyChainId: options?.keyChainId ?? null,
            elements,
            stack,
            bits,
        });

        await this.createListJWT(entry);
        return entry;
    }

    /**
     * Create status list tokens (JWT and CWT) and update the entity.
     * The JWT includes:
     * - `iat`: When the token was issued (REQUIRED)
     * - `exp`: When the token expires (RECOMMENDED)
     * - `ttl`: How long verifiers can cache before fetching fresh copy (RECOMMENDED)
     * - `aggregation_uri`: URI to fetch all status list URIs (OPTIONAL, per RFC Section 9)
     */
    async createListJWT(entry: StatusListEntity): Promise<void> {
        // Get TTL from tenant config or global default
        const effectiveConfig =
            await this.statusListConfigService.getEffectiveConfig(
                entry.tenantId,
            );
        const aggregationUri = effectiveConfig.enableAggregation
            ? this.buildAggregationUri(entry.tenantId)
            : undefined;
        const list = new StatusList(entry.elements, entry.bits, aggregationUri);
        const iss = `${this.configService.getOrThrow<string>("PUBLIC_URL")}`;
        const sub = this.buildStatusListUri(entry.tenantId, entry.id);
        const ttl = effectiveConfig.ttl!;
        const now = Math.floor(Date.now() / 1000);
        const exp = now + ttl;

        const prePayload: JwtPayload = {
            iss,
            sub,
            iat: now,
            exp,
            ttl, // Maximum cache time in seconds for verifiers
        };

        const cert = await this.getSigningCert(entry);

        const preHeader: StatusListJWTHeaderParameters = {
            alg: "ES256",
            typ: "statuslist+jwt",
            x5c: this.certService.getLeafCertBase64(cert),
        };
        const { header, payload } = createHeaderAndPayload(
            list,
            prePayload,
            preHeader,
        );

        // Add aggregation_uri to status_list if enabled for this tenant (RFC Section 9.2)
        // This allows relying parties to pre-fetch all status lists for offline validation
        if (effectiveConfig.enableAggregation && payload.status_list) {
            (payload.status_list as Record<string, unknown>).aggregation_uri =
                aggregationUri;
        }

        const jwt = await this.keyChainService.signJWT(
            payload,
            header,
            entry.tenantId,
            cert.keyId,
        );

        const issuedAt = new Date(now * 1000);
        const expirationTime = new Date(exp * 1000);
        const cwt = await this.signStatusListCwt(
            entry.tenantId,
            cert.keyId,
            cert.crt,
            {
                subject: sub,
                issuedAt,
                expirationTime,
                ttl,
                statusList: list,
            },
        );

        // Store JWT/CWT and expiration time
        const expiresAt = new Date(exp * 1000);
        await this.statusListRepository.update(
            { id: entry.id, tenantId: entry.tenantId },
            { jwt, cwt: Buffer.from(cwt).toString("base64url"), expiresAt },
        );
    }

    private async signStatusListCwt(
        tenantId: string,
        keyId: string,
        certChainPem: string[],
        payload: {
            subject: string;
            issuedAt: Date;
            expirationTime?: Date;
            ttl?: number;
            statusList: StatusList;
        },
    ): Promise<Uint8Array> {
        const x5chain = certChainPem.map(
            (pem) => new Uint8Array(new X509Certificate(pem).rawData),
        );

        const cwt = new StatusListCwt({
            payload: {
                subject: payload.subject,
                issuedAt: payload.issuedAt,
                expirationTime: payload.expirationTime,
                timeToLive: payload.ttl,
                statusList: payload.statusList,
            },
            protectedHeaders: new Map<number, unknown>([
                [1, SignatureAlgorithm.ES256],
                [4, new TextEncoder().encode(keyId)],
                // mDOC status verification expects x5chain in protected headers.
                [33, x5chain],
            ]),
        });

        return cwt.signAndEncode(
            {
                signingKey: { algorithm: SignatureAlgorithm.ES256 } as never,
                algorithm: SignatureAlgorithm.ES256,
            },
            {
                sign: async ({ toBeSigned }) =>
                    this.keyChainService.signBytes(toBeSigned, tenantId, keyId),
            },
        );
    }

    /**
     * Get all status lists for a tenant.
     * @param tenantId The ID of the tenant.
     * @returns Array of status lists.
     */
    async getLists(tenantId: string): Promise<StatusListEntity[]> {
        return this.statusListRepository.find({
            where: { tenantId },
            order: { createdAt: "ASC" },
        });
    }

    /**
     * Get all status list URIs for a tenant.
     * Used for the status list aggregation endpoint (RFC Section 9.3).
     * @param tenantId The ID of the tenant.
     * @returns Array of status list URIs.
     */
    async getStatusListUris(tenantId: string): Promise<string[]> {
        const lists = await this.getLists(tenantId);
        return lists.map((list) => this.buildStatusListUri(tenantId, list.id));
    }

    /**
     * Get a specific status list by ID.
     * @param tenantId The ID of the tenant.
     * @param listId The ID of the status list.
     * @returns The status list entity.
     */
    async getListById(
        tenantId: string,
        listId: string,
    ): Promise<StatusListEntity> {
        const list = await this.statusListRepository.findOneBy({
            id: listId,
            tenantId,
        });
        if (!list) {
            throw new NotFoundException(`Status list ${listId} not found`);
        }
        return list;
    }

    /**
     * Get the JWT for a specific status list.
     * @param tenantId The ID of the tenant.
     * @param listId The ID of the status list.
     * @returns The JWT for the status list.
     */
    async getListJwt(tenantId: string, listId: string): Promise<string> {
        let list = await this.getListById(tenantId, listId);

        // Check if JWT needs regeneration (expired or missing)
        const needsRegeneration =
            !list.jwt || !list.expiresAt || list.expiresAt <= new Date();

        if (needsRegeneration) {
            await this.createListJWT(list);
            // Reload to get the updated JWT
            list = await this.getListById(tenantId, listId);
        }

        return list.jwt!;
    }

    /**
     * Get the CWT for a specific status list.
     * The CWT follows the same caching/freshness policy as JWT status list tokens.
     */
    async getListCwt(tenantId: string, listId: string): Promise<Uint8Array> {
        let list = await this.getListById(tenantId, listId);

        const needsRegeneration =
            !list.jwt || !list.expiresAt || list.expiresAt <= new Date();

        if (needsRegeneration) {
            await this.createListJWT(list);
            list = await this.getListById(tenantId, listId);
        }

        if (!list.cwt) {
            const jwt = list.jwt!;
            const jwtPayload = decodeJwt(jwt);
            const statusList = getListFromStatusListJWT(jwt);
            const cert = await this.getSigningCert(list);

            const subject =
                typeof jwtPayload.sub === "string"
                    ? jwtPayload.sub
                    : this.buildStatusListUri(tenantId, listId);
            const issuedAt =
                typeof jwtPayload.iat === "number"
                    ? new Date(jwtPayload.iat * 1000)
                    : new Date();
            const expirationTime =
                typeof jwtPayload.exp === "number"
                    ? new Date(jwtPayload.exp * 1000)
                    : undefined;
            const ttl =
                typeof jwtPayload.ttl === "number" ? jwtPayload.ttl : undefined;

            const cwt = await this.signStatusListCwt(
                tenantId,
                cert.keyId,
                cert.crt,
                {
                    subject,
                    issuedAt,
                    expirationTime,
                    ttl,
                    statusList,
                },
            );

            await this.statusListRepository.update(
                { id: list.id, tenantId: list.tenantId },
                { cwt: Buffer.from(cwt).toString("base64url") },
            );
            list = await this.getListById(tenantId, listId);
        }

        return Uint8Array.from(Buffer.from(list.cwt!, "base64url"));
    }

    /**
     * Check if there are still free entries available for a credential configuration.
     * @param tenantId The tenant ID.
     * @param credentialConfigurationId The credential configuration ID.
     * @returns True if there are free entries.
     */
    async hasStillFreeEntries(
        tenantId: string,
        credentialConfigurationId?: string,
    ): Promise<boolean> {
        // Check for dedicated list first, then shared lists
        const list = await this.findAvailableList(
            tenantId,
            credentialConfigurationId,
        );
        return list !== null;
    }

    /**
     * Find an available status list with free entries.
     * Priority: dedicated list for the credential config > shared lists
     * @param tenantId The tenant ID.
     * @param credentialConfigurationId Optional credential config ID.
     * @returns The available list or null if none found.
     */
    private async findAvailableList(
        tenantId: string,
        credentialConfigurationId?: string,
    ): Promise<StatusListEntity | null> {
        // First, try to find a dedicated list for this credential config with free entries
        if (credentialConfigurationId) {
            const dedicatedList = await this.statusListRepository.findOne({
                where: {
                    tenantId,
                    credentialConfigurationId,
                    // TypeORM doesn't support array length checks directly,
                    // so we'll filter after fetching
                },
                order: { createdAt: "ASC" },
            });
            if (dedicatedList && dedicatedList.stack.length > 0) {
                return dedicatedList;
            }
        }

        // Then, try to find any shared list (credentialConfigurationId is null) with free entries
        const sharedLists = await this.statusListRepository.find({
            where: {
                tenantId,
                credentialConfigurationId: IsNull(),
            },
            order: { createdAt: "ASC" },
        });

        for (const list of sharedLists) {
            if (list.stack.length > 0) {
                return list;
            }
        }

        return null;
    }

    /**
     * Get the next free entry in the status list.
     * Automatically creates a new list if no available list is found.
     * @param session The session for which to create the entry.
     * @param credentialConfigurationId The credential configuration ID.
     * @returns The status list payload to include in the credential.
     */
    async createEntry(
        session: Session,
        credentialConfigurationId: string,
    ): Promise<JWTwithStatusListPayload> {
        // Find an available list or create a new one
        // If no available list found, create a new shared list
        // (dedicated lists must be created explicitly via the API)
        const list =
            (await this.findAvailableList(
                session.tenantId,
                credentialConfigurationId,
            )) ?? (await this.createNewList(session.tenantId));

        // Pop an index from the stack
        const idx = list.stack.pop();
        if (idx === undefined) {
            // This shouldn't happen since we just checked, but handle it gracefully
            throw new ConflictException(
                "No free entries available in any status list",
            );
        }

        // Save the updated stack
        await this.statusListRepository.update(
            { id: list.id },
            { stack: list.stack },
        );

        const uri = this.buildStatusListUri(session.tenantId, list.id);

        // Store the index in the status mapping
        await this.statusMappingRepository.save({
            tenantId: session.tenantId,
            sessionId: session.id,
            statusListId: list.id,
            index: idx,
            list: uri,
            credentialConfigurationId,
        });

        return {
            status: {
                status_list: {
                    idx,
                    uri,
                },
            },
        };
    }

    /**
     * Update the value of an entry in a specific status list.
     * JWT regeneration depends on the tenant's `immediateUpdate` setting:
     * - If true: JWT is regenerated immediately
     * - If false (default): JWT is only regenerated on next request when TTL expires
     * @param listId The ID of the status list.
     * @param index The index in the status list.
     * @param value The new status value.
     * @param tenantId The tenant ID.
     */
    private async setEntry(
        listId: string,
        index: number,
        value: number,
        tenantId: string,
    ): Promise<void> {
        const entry = await this.getListById(tenantId, listId);
        entry.elements[index] = value;
        await this.statusListRepository.update(
            { id: listId },
            { elements: entry.elements },
        );

        // Check if immediate JWT regeneration is enabled
        const effectiveConfig =
            await this.statusListConfigService.getEffectiveConfig(tenantId);
        if (effectiveConfig.immediateUpdate) {
            await this.createListJWT(entry);
        }
    }

    /**
     * Update the status of a session and its credential configuration.
     * @param value The status update DTO.
     * @param tenantId The tenant ID.
     */
    async updateStatus(
        value: StatusUpdateDto,
        tenantId: string,
    ): Promise<void> {
        const entries = await this.statusMappingRepository.findBy({
            tenantId,
            sessionId: value.sessionId,
            credentialConfigurationId: value.credentialConfigurationId,
        });
        if (entries.length === 0) {
            throw new ConflictException(
                `No status mapping found for session ${value.sessionId} and credential configuration ${value.credentialConfigurationId}`,
            );
        }
        for (const entry of entries) {
            await this.setEntry(
                entry.statusListId,
                entry.index,
                value.status,
                tenantId,
            );
        }
    }

    /**
     * Delete a status list by ID.
     * Only allows deletion if the list has no used entries.
     * @param tenantId The tenant ID.
     * @param listId The status list ID.
     */
    async deleteList(tenantId: string, listId: string): Promise<void> {
        // Verify the list exists (throws NotFoundException if not)
        await this.getListById(tenantId, listId);

        // Check if any entries are in use (mappings exist)
        const mappingsCount = await this.statusMappingRepository.countBy({
            tenantId,
            statusListId: listId,
        });

        if (mappingsCount > 0) {
            throw new ConflictException(
                `Cannot delete status list ${listId}: ${mappingsCount} credentials are using it`,
            );
        }

        await this.statusListRepository.delete({ id: listId, tenantId });
    }

    /**
     * Update a status list's configuration (credential binding and/or certificate).
     * @param tenantId The tenant ID.
     * @param listId The status list ID.
     * @param updates The updates to apply.
     */
    async updateList(
        tenantId: string,
        listId: string,
        updates: {
            credentialConfigurationId?: string | null;
            keyChainId?: string | null;
        },
    ): Promise<StatusListEntity> {
        const list = await this.getListById(tenantId, listId);

        // Validate new keyChainId if provided
        if (updates.keyChainId !== undefined && updates.keyChainId !== null) {
            const cert = await this.certService.find({
                tenantId,
                type: KeyUsageType.StatusList,
                fallbackType: KeyUsageType.Attestation,
                keyId: updates.keyChainId,
            });
            if (!cert) {
                throw new NotFoundException(
                    `Key chain ${updates.keyChainId} not found for tenant ${tenantId}`,
                );
            }
        }

        let needsJwtRegeneration = false;

        if (updates.credentialConfigurationId !== undefined) {
            list.credentialConfigurationId = updates.credentialConfigurationId;
        }

        if (updates.keyChainId !== undefined) {
            list.keyChainId = updates.keyChainId;
            needsJwtRegeneration = true;
        }

        const savedList = await this.statusListRepository.save(list);

        // Regenerate JWT if the certificate changed
        if (needsJwtRegeneration) {
            await this.createListJWT(savedList);
            // Reload to get the updated JWT
            return this.getListById(tenantId, listId);
        }

        return savedList;
    }

    /**
     * Import status list configurations for a specific tenant.
     */
    async importForTenant(tenantId: string): Promise<void> {
        await this.configImportService.importConfigsForTenant<StatusListImportDto>(
            tenantId,
            {
                subfolder: "issuance/status-lists",
                fileExtension: ".json",
                validationClass: StatusListImportDto,
                resourceType: "status list",
                checkExists: async (tid, data) => {
                    // Check if a list with this ID already exists
                    const existing = await this.statusListRepository.findOneBy({
                        id: data.id,
                        tenantId: tid,
                    });
                    return existing !== null;
                },
                deleteExisting: async (tid, data) => {
                    // Check if the list has any mappings before deleting
                    const mappingsCount =
                        await this.statusMappingRepository.countBy({
                            tenantId: tid,
                            statusListId: data.id,
                        });
                    if (mappingsCount > 0) {
                        this.logger.warn(
                            `[${tid}] Cannot reimport status list ${data.id}: ${mappingsCount} credentials are using it`,
                        );
                        return;
                    }
                    await this.statusListRepository.delete({
                        id: data.id,
                        tenantId: tid,
                    });
                },
                processItem: async (tid, config) => {
                    await this.processStatusListConfig(tid, config);
                },
            },
        );
    }

    /**
     * Process a status list config for import.
     */
    private async processStatusListConfig(
        tenantId: string,
        config: StatusListImportDto,
    ) {
        // Get effective size and bits (from config, tenant defaults, or global defaults)
        const size =
            config.capacity ?? (await this.getEffectiveCapacity(tenantId));
        const bits = config.bits ?? (await this.getEffectiveBits(tenantId));

        // Create the shuffled stack
        const elements = new Array(size).fill(0).map(() => 0);
        const stack = this.shuffleArray(
            new Array(size).fill(0).map((_, i) => i),
        );

        // Validate keyChainId if provided
        if (config.keyChainId) {
            const cert = await this.certService.find({
                tenantId,
                type: KeyUsageType.StatusList,
                fallbackType: KeyUsageType.Attestation,
                keyId: config.keyChainId,
            });
            if (!cert) {
                throw new Error(
                    `Key chain ${config.keyChainId} not found for tenant ${tenantId}`,
                );
            }
        }

        // Save with the provided ID
        const entry = await this.statusListRepository.save({
            id: config.id,
            tenantId,
            credentialConfigurationId: config.credentialConfigurationId ?? null,
            keyChainId: config.keyChainId ?? null,
            elements,
            stack,
            bits,
        });

        // Generate the JWT
        await this.createListJWT(entry);
    }
}
