import { randomInt } from "node:crypto";
import {
    ConflictException,
    Injectable,
    Logger,
    NotFoundException,
    ServiceUnavailableException,
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
import { DataSource, IsNull, Repository } from "typeorm";
import { v4 } from "uuid";
import { TenantEntity } from "../../auth/tenant/entities/tenant.entity";
import { CertService } from "../../crypto/key/cert/cert.service";
import { KeyUsageType } from "../../crypto/key/types/key-usage-type";
import { KeyChainService } from "../../crypto/key/key-chain.service";
import { Session } from "../../session/entities/session.entity";
import { ConfigImportService } from "../../platform/config-import/config-import.service";
import {
    ConfigImportOrchestratorService,
    ImportPhase,
} from "../../platform/config-import/config-import-orchestrator.service";
import { StatusListImportDto } from "./dto/status-list-import.dto";
import { StatusListImportSchema } from "./dto/status-list.schema";
import { StatusUpdateDto } from "./dto/status-update.dto";
import { StatusListEntity } from "./entities/status-list.entity";
import { StatusMapping } from "./entities/status-mapping.entity";
import { StatusListConfigService } from "./status-list-config.service";

@Injectable()
export class StatusListService {
    private readonly logger = new Logger(StatusListService.name);
    private readonly maxRetries = 3;
    private readonly retryDelayMs = 100;

    constructor(
        private readonly configService: ConfigService,
        private readonly certService: CertService,
        public readonly keyChainService: KeyChainService,
        private readonly dataSource: DataSource,
        @InjectRepository(StatusMapping)
        private readonly statusMappingRepository: Repository<StatusMapping>,
        @InjectRepository(StatusListEntity)
        private readonly statusListRepository: Repository<StatusListEntity>,
        @InjectRepository(TenantEntity)
        private readonly tenantRepository: Repository<TenantEntity>,
        private readonly configImportService: ConfigImportService,
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
     *
     * Uses optimistic locking to prevent stale token values from overwriting newer state.
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

        // Store JWT/CWT and expiration time with version check
        // Reload entry to get current version before update
        const currentEntry = await this.getListById(entry.tenantId, entry.id);
        const expiresAt = new Date(exp * 1000);
        const updateResult = await this.statusListRepository.update(
            {
                id: entry.id,
                tenantId: entry.tenantId,
                version: currentEntry.version,
            },
            {
                jwt,
                cwt: Buffer.from(cwt).toString("base64url"),
                expiresAt,
                version: () => "version + 1",
            },
        );

        if (updateResult.affected === 0) {
            // Version mismatch - entry was modified concurrently
            // Log but don't fail - JWT regeneration will be retried on next request
            this.logger.warn(
                `Stale JWT generation for list ${entry.id} (tenant: ${entry.tenantId}) - version changed concurrently`,
            );
        }
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

            const currentEntry = await this.getListById(tenantId, listId);
            await this.statusListRepository.update(
                {
                    id: list.id,
                    tenantId: list.tenantId,
                    version: currentEntry.version,
                },
                {
                    cwt: Buffer.from(cwt).toString("base64url"),
                    version: () => "version + 1",
                },
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
     * Uses atomic batch allocation to prevent race conditions.
     * @param session The session for which to create the entry.
     * @param credentialConfigurationId The credential configuration ID.
     * @returns The status list payload to include in the credential.
     */
    async createEntry(
        session: Session,
        credentialConfigurationId: string,
    ): Promise<JWTwithStatusListPayload> {
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const result = await this.allocateEntries({
                    tenantId: session.tenantId,
                    sessionId: session.id,
                    credentialConfigurationId,
                    count: 1,
                });

                if (result.length === 0) {
                    throw new ConflictException(
                        "Failed to allocate status entry after retries",
                    );
                }

                const entry = result[0];
                return {
                    status: {
                        status_list: {
                            idx: entry.index,
                            uri: entry.uri,
                        },
                    },
                };
            } catch (error) {
                // Retry on version conflicts or transient errors
                if (
                    attempt < this.maxRetries - 1 &&
                    (error instanceof ConflictException ||
                        (error instanceof Error &&
                            error.message.includes("version")))
                ) {
                    await this.delay(this.retryDelayMs * Math.pow(2, attempt));
                    continue;
                }
                throw error;
            }
        }

        throw new ServiceUnavailableException(
            "Could not allocate status entry after maximum retries",
        );
    }

    /**
     * Allocate one or more status list entries atomically.
     * All entries for a single credential are allocated in one transaction,
     * ensuring consistency and preventing partial allocations.
     *
     * @param options Allocation request parameters
     * @returns Array of allocated entries
     */
    private async allocateEntries(options: {
        tenantId: string;
        sessionId: string;
        credentialConfigurationId: string;
        count: number;
    }): Promise<Array<{ statusListId: string; index: number; uri: string }>> {
        const queryRunner = this.dataSource.createQueryRunner();

        try {
            await queryRunner.connect();
            await queryRunner.startTransaction();

            // Find an available status list
            const manager = queryRunner.manager;
            let list = await manager.findOne(StatusListEntity, {
                where: {
                    tenantId: options.tenantId,
                    credentialConfigurationId:
                        options.credentialConfigurationId,
                },
                order: { createdAt: "ASC" },
                lock: { mode: "pessimistic_write" },
            });

            if (!list || list.stack.length < options.count) {
                // Try to find a shared list
                const sharedLists = await manager.find(StatusListEntity, {
                    where: {
                        tenantId: options.tenantId,
                        credentialConfigurationId: IsNull(),
                    },
                    order: { createdAt: "ASC" },
                    lock: { mode: "pessimistic_write" },
                });

                for (const candidateList of sharedLists) {
                    if (candidateList.stack.length >= options.count) {
                        list = candidateList;
                        break;
                    }
                }
            }

            // If still no list found, create a new one
            if (!list || list.stack.length < options.count) {
                // Don't hold a lock while creating - it's a separate operation
                await queryRunner.commitTransaction();
                await queryRunner.release();

                list = await this.createNewList(options.tenantId);

                // Retry the allocation with the new list
                return this.allocateEntries(options);
            }

            // Allocate indices from the stack
            const allocatedIndices: number[] = [];
            for (let i = 0; i < options.count; i++) {
                const idx = list.stack.pop();
                if (idx === undefined) {
                    // This should not happen due to our check above, but handle it
                    throw new ConflictException(
                        "Stack underflow during allocation",
                    );
                }
                allocatedIndices.push(idx);
            }

            // Perform atomic update with version check
            const updateResult = await manager.update(
                StatusListEntity,
                {
                    id: list.id,
                    tenantId: options.tenantId,
                    version: list.version,
                },
                {
                    stack: list.stack,
                    version: () => "version + 1",
                },
            );

            if (updateResult.affected === 0) {
                // Version mismatch - another transaction modified the list
                throw new ConflictException(
                    "Status list was modified concurrently",
                );
            }

            // Create status mappings for all allocated indices
            const uri = this.buildStatusListUri(options.tenantId, list.id);
            const mappings = allocatedIndices.map((index) => ({
                tenantId: options.tenantId,
                sessionId: options.sessionId,
                statusListId: list.id,
                index,
                list: uri,
                credentialConfigurationId: options.credentialConfigurationId,
            }));

            await manager.insert(StatusMapping, mappings);

            await queryRunner.commitTransaction();

            // Return allocated entries
            return allocatedIndices.map((index) => ({
                statusListId: list.id,
                index,
                uri,
            }));
        } catch (error) {
            await queryRunner.rollbackTransaction();

            // Handle unique constraint violations
            if (
                error instanceof Error &&
                error.message.includes("UQ_status_mapping_tenant_list_index")
            ) {
                throw new ConflictException(
                    "Status list index allocation conflict - please retry",
                );
            }

            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    /**
     * Helper function to introduce a delay for retry logic.
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Update the value of an entry in a specific status list.
     * Uses optimistic locking to ensure atomic updates and prevent lost writes.
     * JWT regeneration depends on the tenant's `immediateUpdate` setting:
     * - If true: JWT is regenerated immediately (after transaction commits)
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
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                await this.setEntryWithRetry(listId, index, value, tenantId);
                return;
            } catch (error) {
                // Retry on version conflicts
                if (
                    attempt < this.maxRetries - 1 &&
                    error instanceof ConflictException &&
                    error.message.includes("version")
                ) {
                    await this.delay(this.retryDelayMs * Math.pow(2, attempt));
                    continue;
                }
                throw error;
            }
        }

        throw new ServiceUnavailableException(
            "Could not update status entry after maximum retries",
        );
    }

    /**
     * Internal method that performs a single attempt to update an entry.
     */
    private async setEntryWithRetry(
        listId: string,
        index: number,
        value: number,
        tenantId: string,
    ): Promise<void> {
        const queryRunner = this.dataSource.createQueryRunner();

        try {
            await queryRunner.connect();
            await queryRunner.startTransaction();

            const manager = queryRunner.manager;

            // Read the current state with a lock
            const entry = await manager.findOne(StatusListEntity, {
                where: { id: listId, tenantId },
                lock: { mode: "pessimistic_write" },
            });

            if (!entry) {
                throw new NotFoundException(
                    `Status list ${listId} not found for tenant ${tenantId}`,
                );
            }

            // Modify the elements array
            const updatedElements = [...entry.elements];
            updatedElements[index] = value;

            // Perform atomic update with version check
            const updateResult = await manager.update(
                StatusListEntity,
                {
                    id: listId,
                    tenantId,
                    version: entry.version,
                },
                {
                    elements: updatedElements,
                    jwt: undefined,
                    cwt: undefined,
                    expiresAt: undefined,
                    version: () => "version + 1",
                } as any,
            );

            if (updateResult.affected === 0) {
                // Version mismatch - another transaction modified the list
                throw new ConflictException(
                    "Status list version changed concurrently",
                );
            }

            await queryRunner.commitTransaction();

            // Regenerate JWT if immediate update is enabled
            // Do this AFTER transaction commits to avoid holding connection
            const effectiveConfig =
                await this.statusListConfigService.getEffectiveConfig(tenantId);
            if (effectiveConfig.immediateUpdate) {
                // Reload the entry with updated version
                const updatedEntry = await this.getListById(tenantId, listId);
                await this.createListJWT(updatedEntry);
            }
        } finally {
            await queryRunner.release();
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
                validationSchema: StatusListImportSchema,
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
