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
import { SignatureAlgorithm } from "@owf/cose";
import {
    BitsPerStatus,
    createHeaderAndPayload,
    JWTwithStatusListPayload,
    StatusList,
    StatusListCwt,
    StatusListJWTHeaderParameters,
} from "@owf/token-status-list";
import { X509Certificate } from "@peculiar/x509";
import { JwtPayload } from "@sd-jwt/core";
import { DataSource, IsNull, Repository } from "typeorm";
import { v4 } from "uuid";
import { TenantEntity } from "../../auth/tenant/entities/tenant.entity";
import { CertService } from "../../crypto/key/cert/cert.service";
import { KeyChainService } from "../../crypto/key/key-chain.service";
import { KeyUsageType } from "../../crypto/key/types/key-usage-type";
import { ConfigImportService } from "../../platform/config-import/config-import.service";
import {
    ConfigImportOrchestratorService,
    ImportPhase,
} from "../../platform/config-import/config-import-orchestrator.service";
import { Session } from "../../session/entities/session.entity";
import type { CredentialConfig } from "../configuration/credentials/entities/credential.entity";
import { StatusListImportSchema } from "./dto/status-list.schema";
import { StatusListImportDto } from "./dto/status-list-import.dto";
import { StatusUpdateDto } from "./dto/status-update.dto";
import { ActiveCredentialSlot } from "./entities/active-credential-slot.entity";
import { StatusListEntity } from "./entities/status-list.entity";
import { StatusMapping } from "./entities/status-mapping.entity";
import { StatusListConfigService } from "./status-list-config.service";
import { SubjectKeyService } from "./subject-key.service";

/**
 * Status list value meaning "revoked", per the convention documented on
 * {@link StatusUpdateDto}: 0 = valid, 1 = revoked, 2 = suspended.
 */
const STATUS_REVOKED = 1;

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
        @InjectRepository(ActiveCredentialSlot)
        private readonly activeCredentialSlotRepository: Repository<ActiveCredentialSlot>,
        private readonly subjectKeyService: SubjectKeyService,
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

        return this.regenerateListTokens(entry.tenantId, entry.id);
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
    async createListJWT(entry: StatusListEntity): Promise<boolean> {
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

        // Only cache tokens if the entity still matches the snapshot that was signed.
        const expiresAt = new Date(exp * 1000);
        const updateResult = await this.statusListRepository.update(
            {
                id: entry.id,
                tenantId: entry.tenantId,
                version: entry.version,
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
            return false;
        }

        return true;
    }

    /**
     * Generate tokens from the latest status-list snapshot, retrying when the
     * list changes while the asynchronous signing operation is in progress.
     */
    private async regenerateListTokens(
        tenantId: string,
        listId: string,
    ): Promise<StatusListEntity> {
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            const entry = await this.getListById(tenantId, listId);
            if (await this.createListJWT(entry)) {
                return this.getListById(tenantId, listId);
            }

            if (attempt < this.maxRetries - 1) {
                await this.delay(this.retryDelayMs * Math.pow(2, attempt));
            }
        }

        throw new ServiceUnavailableException(
            `Could not generate current tokens for status list ${listId}`,
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
            list = await this.regenerateListTokens(tenantId, listId);
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
            !list.jwt ||
            !list.cwt ||
            !list.expiresAt ||
            list.expiresAt <= new Date();

        if (needsRegeneration) {
            list = await this.regenerateListTokens(tenantId, listId);
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
        credentialConfiguration?: CredentialConfig,
    ): Promise<JWTwithStatusListPayload> {
        // Resolve the pseudonymous subject key when the active-credential-limit
        // policy applies to this issuance; undefined means "policy off" and the
        // behaviour below is unchanged from before.
        const subjectScopedKey = await this.resolveSubjectScopedKey(
            session,
            credentialConfigurationId,
            credentialConfiguration,
        );
        const issuanceSetId = subjectScopedKey ? v4() : undefined;

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const result = await this.allocateEntries({
                    tenantId: session.tenantId,
                    sessionId: session.id,
                    credentialConfigurationId,
                    count: 1,
                    issuanceSetId,
                });

                if (result.length === 0) {
                    throw new ConflictException(
                        "Failed to allocate status entry after retries",
                    );
                }

                // The new entry now exists. Only after that do we claim the
                // subject's slot and revoke whatever it pointed at before, so a
                // failure above can never leave the subject with nothing valid.
                if (subjectScopedKey && issuanceSetId) {
                    await this.replaceActiveIssuance({
                        tenantId: session.tenantId,
                        credentialConfigurationId,
                        subjectScopedKey,
                        issuanceSetId,
                    });
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
                if (this.isRetryableConcurrencyError(error)) {
                    if (attempt < this.maxRetries - 1) {
                        await this.delay(
                            this.retryDelayMs * Math.pow(2, attempt),
                        );
                        continue;
                    }
                    break;
                }
                throw error;
            }
        }

        throw new ServiceUnavailableException(
            "Could not allocate status entry after maximum retries",
        );
    }

    /**
     * Resolve the pseudonymous subject key for the active-credential-limit
     * policy, or `undefined` when the policy does not apply to this issuance.
     *
     * Returns undefined when the configuration is absent, the policy is
     * disabled, status management is off (revocation needs status entries), or
     * no durable subject identity is available on the session.
     */
    private async resolveSubjectScopedKey(
        session: Session,
        credentialConfigurationId: string,
        credentialConfiguration?: CredentialConfig,
    ): Promise<string | undefined> {
        const policy = credentialConfiguration?.activeCredentials;
        if (!policy?.enabled) {
            return undefined;
        }

        if (!credentialConfiguration?.statusManagement) {
            this.logger.warn(
                `activeCredentials is enabled for '${credentialConfigurationId}' but statusManagement is disabled; skipping enforcement.`,
            );
            return undefined;
        }

        const iss = session.externalIssuer;
        const sub = session.externalSubject;
        if (!iss || !sub) {
            // No durable per-user subject for this flow (for example the
            // built-in authorization server, whose `sub` is session-scoped).
            // Enforcing on a session-scoped subject would treat every issuance
            // as a new subject, so the policy is skipped instead.
            this.logger.debug(
                `No durable subject identity for session ${session.id}; skipping active-credential enforcement.`,
            );
            return undefined;
        }

        return this.subjectKeyService.deriveSubjectKey({
            tenantId: session.tenantId,
            credentialConfigurationId,
            iss,
            sub,
        });
    }

    /**
     * Point the subject's slot at the newly issued set and revoke whatever it
     * pointed at before.
     *
     * Concurrency rests on the unique constraint over
     * (tenantId, credentialConfigurationId, subjectScopedKey) rather than on
     * locking: two simultaneous first issuances both try to insert, exactly one
     * succeeds, and the loser falls through to the update path. Updates use the
     * slot's version as a compare-and-swap so a concurrent writer cannot be
     * silently overwritten. Whichever issuance commits last owns the slot, and
     * the set it displaced is revoked — so the subject converges on a single
     * active set either way.
     */
    private async replaceActiveIssuance(params: {
        tenantId: string;
        credentialConfigurationId: string;
        subjectScopedKey: string;
        issuanceSetId: string;
    }): Promise<void> {
        let previousIssuanceSetId: string | null = null;

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            const existing = await this.activeCredentialSlotRepository.findOne({
                where: {
                    tenantId: params.tenantId,
                    credentialConfigurationId: params.credentialConfigurationId,
                    subjectScopedKey: params.subjectScopedKey,
                },
            });

            if (!existing) {
                try {
                    await this.activeCredentialSlotRepository.insert({
                        tenantId: params.tenantId,
                        credentialConfigurationId:
                            params.credentialConfigurationId,
                        subjectScopedKey: params.subjectScopedKey,
                        issuanceSetId: params.issuanceSetId,
                    });
                    // First issuance for this subject: nothing to revoke.
                    return;
                } catch (error) {
                    if (this.isUniqueViolation(error)) {
                        // Another issuance created the slot first; re-read and
                        // take the update path.
                        continue;
                    }
                    throw error;
                }
            }

            const updateResult =
                await this.activeCredentialSlotRepository.update(
                    {
                        id: existing.id,
                        version: existing.version,
                    },
                    {
                        issuanceSetId: params.issuanceSetId,
                        version: () => "version + 1",
                    },
                );

            if (updateResult.affected === 0) {
                // Someone else advanced the slot between our read and write.
                await this.delay(this.retryDelayMs * Math.pow(2, attempt));
                continue;
            }

            previousIssuanceSetId = existing.issuanceSetId ?? null;
            break;
        }

        if (!previousIssuanceSetId) {
            return;
        }

        await this.revokeIssuanceSet(
            params.tenantId,
            params.credentialConfigurationId,
            previousIssuanceSetId,
        );
    }

    /**
     * Revoke every status entry belonging to one issuance set.
     *
     * Failures here leave the newly issued credential valid and the displaced
     * entries untouched, which is the safe direction: a stale credential that
     * outlives its replacement is recoverable, revoking a credential the holder
     * never replaced is not.
     */
    private async revokeIssuanceSet(
        tenantId: string,
        credentialConfigurationId: string,
        issuanceSetId: string,
    ): Promise<void> {
        const entries = await this.statusMappingRepository.findBy({
            tenantId,
            credentialConfigurationId,
            issuanceSetId,
        });

        for (const entry of entries) {
            await this.setEntry(
                entry.statusListId,
                entry.index,
                STATUS_REVOKED,
                tenantId,
            );
        }
    }

    /**
     * Whether an error is a database unique-constraint violation.
     * Matched by driver error code where available, falling back to the
     * constraint name for drivers that only surface a message.
     */
    private isUniqueViolation(error: unknown): boolean {
        if (!(error instanceof Error)) {
            return false;
        }
        const code = (error as { code?: string }).code;
        return (
            code === "23505" || // PostgreSQL unique_violation
            code === "SQLITE_CONSTRAINT_UNIQUE" ||
            code === "SQLITE_CONSTRAINT" ||
            error.message.includes("UQ_active_credential_slot_subject")
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
        /**
         * Opaque grouping id stamped on every mapping created by this call, so
         * the whole issuance can later be revoked as a set. Only set when the
         * active-credential-limit policy applies.
         */
        issuanceSetId?: string;
    }): Promise<Array<{ statusListId: string; index: number; uri: string }>> {
        const queryRunner = this.dataSource.createQueryRunner();
        let shouldCreateList = false;

        try {
            await queryRunner.connect();
            await queryRunner.startTransaction();

            // Find an available status list
            const manager = queryRunner.manager;
            const dedicatedLists = await manager.find(StatusListEntity, {
                where: {
                    tenantId: options.tenantId,
                    credentialConfigurationId:
                        options.credentialConfigurationId,
                },
                order: { createdAt: "ASC" },
            });
            let list = dedicatedLists.find(
                (candidate) => candidate.stack.length >= options.count,
            );

            if (!list) {
                // Try to find a shared list
                const sharedLists = await manager.find(StatusListEntity, {
                    where: {
                        tenantId: options.tenantId,
                        credentialConfigurationId: IsNull(),
                    },
                    order: { createdAt: "ASC" },
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
                await queryRunner.commitTransaction();
                shouldCreateList = true;
            } else {
                // Allocate indices from the stack
                const allocatedIndices: number[] = [];
                for (let i = 0; i < options.count; i++) {
                    const idx = list.stack.pop();
                    if (idx === undefined) {
                        throw new ConflictException(
                            "Stack underflow during allocation",
                        );
                    }
                    allocatedIndices.push(idx);
                }

                // The version predicate makes this update portable across
                // PostgreSQL and SQLite without relying on driver-specific locks.
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
                    throw new ConflictException(
                        "Status list was modified concurrently",
                    );
                }

                const uri = this.buildStatusListUri(options.tenantId, list.id);
                const mappings = allocatedIndices.map((index) => ({
                    tenantId: options.tenantId,
                    sessionId: options.sessionId,
                    statusListId: list.id,
                    index,
                    list: uri,
                    credentialConfigurationId:
                        options.credentialConfigurationId,
                    issuanceSetId: options.issuanceSetId ?? null,
                }));

                await manager.insert(StatusMapping, mappings);
                await queryRunner.commitTransaction();

                return allocatedIndices.map((index) => ({
                    statusListId: list.id,
                    index,
                    uri,
                }));
            }
        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }

            if (this.isRetryableConcurrencyError(error)) {
                throw new ConflictException(
                    "Status list index allocation conflict - please retry",
                );
            }

            throw error;
        } finally {
            await queryRunner.release();
        }

        if (shouldCreateList) {
            const newList = await this.createNewList(options.tenantId);
            if (newList.stack.length < options.count) {
                throw new ConflictException(
                    "Status list capacity is smaller than the requested allocation",
                );
            }
            return this.allocateEntries(options);
        }

        throw new ConflictException("No status list available for allocation");
    }

    /**
     * Helper function to introduce a delay for retry logic.
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private isRetryableConcurrencyError(error: unknown): boolean {
        if (error instanceof ConflictException) {
            return true;
        }

        if (!(error instanceof Error)) {
            return false;
        }

        const databaseError = error as Error & {
            code?: string;
            driverError?: { code?: string };
        };
        const code = databaseError.driverError?.code ?? databaseError.code;
        if (
            code &&
            [
                "23505",
                "40001",
                "40P01",
                "SQLITE_BUSY",
                "SQLITE_BUSY_SNAPSHOT",
                "SQLITE_LOCKED",
            ].includes(code)
        ) {
            return true;
        }

        const message = error.message.toLowerCase();
        return (
            message.includes("version") ||
            message.includes("unique constraint") ||
            message.includes("database is locked")
        );
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
                if (this.isRetryableConcurrencyError(error)) {
                    if (attempt < this.maxRetries - 1) {
                        await this.delay(
                            this.retryDelayMs * Math.pow(2, attempt),
                        );
                        continue;
                    }
                    break;
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
        let updateCommitted = false;

        try {
            await queryRunner.connect();
            await queryRunner.startTransaction();

            const manager = queryRunner.manager;

            const entry = await manager.findOne(StatusListEntity, {
                where: { id: listId, tenantId },
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
                    version: () => "version + 1",
                },
            );

            if (updateResult.affected === 0) {
                // Version mismatch - another transaction modified the list
                throw new ConflictException(
                    "Status list version changed concurrently",
                );
            }

            await queryRunner.commitTransaction();
            updateCommitted = true;
        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            throw error;
        } finally {
            await queryRunner.release();
        }

        if (updateCommitted) {
            const effectiveConfig =
                await this.statusListConfigService.getEffectiveConfig(tenantId);
            if (effectiveConfig.immediateUpdate) {
                await this.regenerateListTokens(tenantId, listId);
            }
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
            return this.regenerateListTokens(tenantId, listId);
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
    async processStatusListConfig(
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

        await this.regenerateListTokens(entry.tenantId, entry.id);
    }
}
