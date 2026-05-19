import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SchedulerRegistry } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import type { UpDownCounter } from "@opentelemetry/api";
import { MetricService } from "nestjs-otel";
import {
    DeepPartial,
    FindOptionsWhere,
    IsNull,
    LessThan,
    Not,
    Repository,
} from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity.js";
import { SessionCleanupMode } from "../auth/tenant/entitites/session-storage-config";
import { TenantEntity } from "../auth/tenant/entitites/tenant.entity";
import { SessionQueryDto } from "./dto/session-query.dto";
import { PaginatedSessionResponseDto } from "./dto/paginated-session-response.dto";
import { Session, SessionStatus } from "./entities/session.entity";
import {
    SESSION_STATUS_CHANGED,
    SessionStatusChangedEvent,
} from "./session-events.service";

@Injectable()
export class SessionService implements OnApplicationBootstrap {
    private readonly logger = new Logger(SessionService.name);
    private readonly sessionsGauge: UpDownCounter;

    constructor(
        @InjectRepository(Session)
        private readonly sessionRepository: Repository<Session>,
        @InjectRepository(TenantEntity)
        private readonly tenantRepository: Repository<TenantEntity>,
        private readonly configService: ConfigService,
        private readonly schedulerRegistry: SchedulerRegistry,
        private readonly eventEmitter: EventEmitter2,
        metricService: MetricService,
    ) {
        this.sessionsGauge = metricService.getUpDownCounter("sessions", {
            description: "Total number of sessions by status",
        });
    }

    /**
     * Register the tidy up cron job on application bootstrap.
     * This will run every hour by default, but can be configured via the `SESSION_TIDY_UP_INTERVAL` config variable.
     * @returns
     */
    async onApplicationBootstrap() {
        const callback = () => {
            void this.tidyUpSessions();
        };
        const intervalTime =
            this.configService.getOrThrow<number>("SESSION_TIDY_UP_INTERVAL") *
            1000;
        const interval = setInterval(callback, intervalTime);
        this.schedulerRegistry.addInterval("tidyUpSessions", interval);

        // Initialize session metrics for all tenants
        const tenants = await this.tenantRepository.find();
        const states: SessionStatus[] = [
            SessionStatus.Active,
            SessionStatus.Fetched,
            SessionStatus.Completed,
            SessionStatus.Expired,
            SessionStatus.Failed,
        ];

        for (const tenant of tenants) {
            for (const state of states) {
                const issuanceCounter = await this.sessionRepository.countBy({
                    tenantId: tenant.id,
                    status: state,
                    requestId: IsNull(), // issuance sessions don't have requestId
                });
                this.sessionsGauge.add(issuanceCounter, {
                    tenant_id: tenant.id,
                    session_type: "issuance",
                    status: state,
                });

                const verificationCounter =
                    await this.sessionRepository.countBy({
                        tenantId: tenant.id,
                        status: state,
                        requestId: Not(IsNull()), // verification sessions have requestId
                    });
                this.sessionsGauge.add(verificationCounter, {
                    tenant_id: tenant.id,
                    session_type: "verification",
                    status: state,
                });
            }
        }

        return this.tidyUpSessions();
    }

    /**
     * Create a new session.
     * @param session
     * @returns
     */
    async create(session: DeepPartial<Session>) {
        const createdSession = await this.sessionRepository.save(session);

        // Count total sessions created
        this.sessionsGauge.add(1, {
            tenant_id: createdSession.tenantId,
            session_type: createdSession.requestId
                ? "verification"
                : "issuance",
            status: "active",
        });

        return createdSession;
    }

    /**
     * Marks the session as successful or failed.
     * Emits a session status change event for SSE subscribers.
     * @param session
     * @param status
     */
    async setState(session: Session, status: SessionStatus) {
        const sessionType = session.requestId ? "verification" : "issuance";

        await this.sessionRepository.update({ id: session.id }, { status });

        // Emit status change event for SSE subscribers
        const event: SessionStatusChangedEvent = {
            sessionId: session.id,
            status,
            updatedAt: new Date(),
            session: { ...session, status },
        };
        this.eventEmitter.emit(SESSION_STATUS_CHANGED, event);

        // Count completed sessions (success or failure)
        this.sessionsGauge.add(1, {
            tenant_id: session.tenantId,
            session_type: sessionType,
            status,
        });

        // Decrease active sessions count
        this.sessionsGauge.add(-1, {
            tenant_id: session.tenantId,
            session_type: sessionType,
            status: "active",
        });
    }

    /**
     * Update an existing session.
     * @param issuer_state
     * @param values
     * @returns
     */
    add(issuer_state: string, values: QueryDeepPartialEntity<Session>) {
        return this.sessionRepository.update({ id: issuer_state }, values);
    }

    /**
     * Get sessions with pagination and optional filtering.
     * @param tenantId
     * @param query - Pagination and filter parameters
     * @returns Paginated session list
     */
    async getAll(
        tenantId: string,
        query: SessionQueryDto,
    ): Promise<PaginatedSessionResponseDto> {
        const { page, pageSize, status, type, sortBy, sortOrder } = query;

        const where: FindOptionsWhere<Session> = { tenantId };

        if (status) {
            where.status = status;
        }

        if (type === "issuance") {
            where.requestId = IsNull();
        } else if (type === "presentation") {
            where.requestId = Not(IsNull());
        }

        const orderColumn = sortBy ?? "updatedAt";
        const orderDirection =
            (sortOrder?.toUpperCase() as "ASC" | "DESC") ?? "DESC";

        const [items, total] = await this.sessionRepository.findAndCount({
            select: ["id", "status", "createdAt", "requestId"],
            where,
            order: { [orderColumn]: orderDirection },
            skip: (page - 1) * pageSize,
            take: pageSize,
            loadEagerRelations: false,
        });

        return {
            items,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }

    /**
     * Get a session by its state.
     * @param state
     * @returns
     */
    get(state: string) {
        return this.sessionRepository.findOneByOrFail({ id: state });
    }

    /**
     * Find a session by its walletNonce (used in wallet-facing URLs).
     * Returns null if no session matches.
     */
    findByWalletNonce(nonce: string) {
        return this.sessionRepository.findOneBy({ walletNonce: nonce });
    }

    /**
     * Get a session by a specific condition.
     * @param where
     * @returns
     */
    getBy(where: FindOptionsWhere<Session>) {
        return this.sessionRepository.findOneByOrFail(where);
    }

    /**
     * Atomically increments the failed tx_code attempt counter for a session.
     * Returns the updated attempt count.
     * Used for brute-force protection in the OID4VCI pre-authorized code flow.
     * @param sessionId The session ID
     * @returns The updated txCodeFailedAttempts count
     */
    async incrementTxCodeFailedAttempts(sessionId: string): Promise<number> {
        await this.sessionRepository.increment(
            { id: sessionId },
            "txCodeFailedAttempts",
            1,
        );
        const session = await this.sessionRepository.findOneByOrFail({
            id: sessionId,
        });
        return session.txCodeFailedAttempts ?? 0;
    }

    /**
     * Tidy up sessions based on per-tenant configuration.
     * Each tenant can configure their own TTL and cleanup mode.
     * - 'full' mode: Deletes the entire session record
     * - 'anonymize' mode: Keeps session metadata but removes personal data
     */
    async tidyUpSessions() {
        const defaultTtlSeconds =
            this.configService.getOrThrow<number>("SESSION_TTL");
        const defaultCleanupMode = this.configService.getOrThrow<string>(
            "SESSION_CLEANUP_MODE",
        );

        // Get all tenants to check for custom session configs
        const tenants = await this.tenantRepository.find();

        // Process each tenant with their specific config
        for (const tenant of tenants) {
            const ttlSeconds =
                tenant.sessionConfig?.ttlSeconds ?? defaultTtlSeconds;
            const cutoffDate = new Date(Date.now() - ttlSeconds * 1000);
            const cleanupMode =
                tenant.sessionConfig?.cleanupMode ?? defaultCleanupMode;

            if (cleanupMode === SessionCleanupMode.Anonymize) {
                // Anonymize: Keep session metadata (including original status) but remove personal data
                // We use a raw query to only target sessions that still have personal data
                const result = await this.sessionRepository
                    .createQueryBuilder()
                    .update()
                    .set({
                        // Clear personal data fields
                        credentials: undefined,
                        credentialPayload: undefined,
                        auth_queries: undefined,
                        offer: undefined,
                        requestObject: undefined,
                    })
                    .where("tenantId = :tenantId", { tenantId: tenant.id })
                    .andWhere("createdAt < :cutoffDate", { cutoffDate })
                    // Only anonymize sessions that still have personal data
                    .andWhere(
                        "(credentials IS NOT NULL OR credentialPayload IS NOT NULL OR auth_queries IS NOT NULL OR offer IS NOT NULL OR requestObject IS NOT NULL)",
                    )
                    .execute();
                if (result.affected && result.affected > 0) {
                    this.logger.log(
                        `Anonymized ${result.affected} sessions for tenant ${tenant.id}`,
                    );
                }
            } else {
                // Full delete (default behavior)
                const result = await this.sessionRepository.delete({
                    tenantId: tenant.id,
                    createdAt: LessThan(cutoffDate),
                });
                if (result.affected && result.affected > 0) {
                    this.logger.log(
                        `Deleted ${result.affected} sessions for tenant ${tenant.id}`,
                    );
                }
            }
        }

        // Also clean up sessions for tenants that no longer exist (orphaned sessions)
        const tenantIds = tenants.map((t) => t.id);
        if (tenantIds.length > 0) {
            const orphanedResult = await this.sessionRepository
                .createQueryBuilder()
                .delete()
                .where("tenantId NOT IN (:...tenantIds)", { tenantIds })
                .andWhere("createdAt < :cutoff", {
                    cutoff: new Date(Date.now() - defaultTtlSeconds * 1000),
                })
                .execute();
            if (orphanedResult.affected && orphanedResult.affected > 0) {
                this.logger.log(
                    `Deleted ${orphanedResult.affected} orphaned sessions`,
                );
            }
        }
    }

    /**
     * Deletes a session by its ID and tenant ID.
     * @param id
     * @param sub
     * @returns
     */
    delete(id: string, sub: string): Promise<any> {
        return this.sessionRepository.delete({ id, tenantId: sub });
    }

    /**
     * Find or create a session by external authorization server identity.
     * Used for wallet-initiated flows where the wallet presents a token from an external AS (e.g., Keycloak).
     * @param tenantId The tenant ID
     * @param externalIssuer The issuer (iss) from the external AS token
     * @param externalSubject The subject (sub) from the external AS token
     * @returns The existing or newly created session
     */
    async findOrCreateByExternalIdentity(
        tenantId: string,
        externalIssuer: string,
        externalSubject: string,
    ): Promise<Session> {
        // Try to find existing session by external identity
        const existingSession = await this.sessionRepository.findOne({
            where: {
                tenantId,
                externalIssuer,
                externalSubject,
                status: SessionStatus.Active,
            },
        });

        if (existingSession) {
            return existingSession;
        }

        // Create new session for external identity
        const { v4: uuidv4 } = await import("uuid");
        const newSession = await this.create({
            id: uuidv4(),
            tenantId,
            externalIssuer,
            externalSubject,
            status: SessionStatus.Active,
            notifications: [],
        });

        this.logger.log(
            `Created session for external identity: iss=${externalIssuer}, sub=${externalSubject}`,
        );

        return newSession;
    }
}
