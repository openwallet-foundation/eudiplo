import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SchedulerRegistry } from "@nestjs/schedule";
import { MetricService } from "nestjs-otel";
import { Repository } from "typeorm";
import { describe, expect, test, vi } from "vitest";
import { SessionCleanupMode } from "../auth/tenant/entities/session-storage-config";
import { TenantEntity } from "../auth/tenant/entities/tenant.entity";
import { Session, SessionStatus } from "./entities/session.entity";
import { SessionService } from "./session.service";
import { SESSION_STATUS_CHANGED } from "./session-events.service";

describe("SessionService", () => {
    test("expires overdue presentation sessions and emits their status changes", async () => {
        const expiredSessions = [
            {
                id: "active-session",
                tenantId: "tenant-1",
                requestId: "request-1",
                status: SessionStatus.Active,
            },
            {
                id: "fetched-session",
                tenantId: "tenant-1",
                requestId: "request-2",
                status: SessionStatus.Fetched,
            },
        ] as Session[];
        const sessionRepository = {
            findBy: vi.fn().mockResolvedValue(expiredSessions),
            update: vi.fn().mockResolvedValue({ affected: 1 }),
        } as unknown as Repository<Session>;
        const tenantRepository = {
            find: vi.fn().mockResolvedValue([]),
        } as unknown as Repository<TenantEntity>;
        const eventEmitter = { emit: vi.fn() } as unknown as EventEmitter2;
        const metricCounter = { add: vi.fn() };
        const service = new SessionService(
            sessionRepository,
            tenantRepository,
            {
                getOrThrow: vi.fn((key: string) =>
                    key === "SESSION_TTL" ? 3600 : "full",
                ),
            } as unknown as ConfigService,
            {} as SchedulerRegistry,
            eventEmitter,
            {
                getUpDownCounter: vi.fn().mockReturnValue(metricCounter),
            } as unknown as MetricService,
        );

        await service.tidyUpSessions();

        expect(sessionRepository.findBy).toHaveBeenCalledOnce();
        expect(sessionRepository.update).toHaveBeenCalledTimes(2);
        expect(sessionRepository.update).toHaveBeenCalledWith(
            { id: "active-session" },
            {
                status: SessionStatus.Expired,
                responseEncryptionPrivateJwk: null,
            },
        );
        expect(sessionRepository.update).toHaveBeenCalledWith(
            { id: "fetched-session" },
            {
                status: SessionStatus.Expired,
                responseEncryptionPrivateJwk: null,
            },
        );
        expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
        expect(eventEmitter.emit).toHaveBeenCalledWith(
            SESSION_STATUS_CHANGED,
            expect.objectContaining({
                sessionId: "active-session",
                status: SessionStatus.Expired,
            }),
        );
        expect(eventEmitter.emit).toHaveBeenCalledWith(
            SESSION_STATUS_CHANGED,
            expect.objectContaining({
                sessionId: "fetched-session",
                status: SessionStatus.Expired,
            }),
        );
    });

    test.each([
        SessionStatus.Completed,
        SessionStatus.Failed,
        SessionStatus.Expired,
    ])(
        "clears the response encryption key when a session becomes %s",
        async (status) => {
            const sessionRepository = {
                update: vi.fn().mockResolvedValue({ affected: 1 }),
            } as unknown as Repository<Session>;
            const tenantRepository = {
                find: vi.fn().mockResolvedValue([]),
            } as unknown as Repository<TenantEntity>;
            const service = new SessionService(
                sessionRepository,
                tenantRepository,
                {} as ConfigService,
                {} as SchedulerRegistry,
                { emit: vi.fn() } as unknown as EventEmitter2,
                {
                    getUpDownCounter: vi.fn().mockReturnValue({ add: vi.fn() }),
                } as unknown as MetricService,
            );
            const session = {
                id: "session-1",
                tenantId: "tenant-1",
                status: SessionStatus.Active,
            } as Session;

            await service.setState(session, status);

            expect(sessionRepository.update).toHaveBeenCalledWith(
                { id: session.id },
                {
                    status,
                    responseEncryptionPrivateJwk: null,
                },
            );
        },
    );

    test("anonymizes sensitive session fields with database NULL values", async () => {
        const queryBuilder = {
            update: vi.fn(),
            delete: vi.fn(),
            set: vi.fn(),
            where: vi.fn(),
            andWhere: vi.fn(),
            execute: vi.fn().mockResolvedValue({ affected: 1 }),
        };
        queryBuilder.update.mockReturnValue(queryBuilder);
        queryBuilder.delete.mockReturnValue(queryBuilder);
        queryBuilder.set.mockReturnValue(queryBuilder);
        queryBuilder.where.mockReturnValue(queryBuilder);
        queryBuilder.andWhere.mockReturnValue(queryBuilder);

        const sessionRepository = {
            findBy: vi.fn().mockResolvedValue([]),
            createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
        } as unknown as Repository<Session>;
        const tenantRepository = {
            find: vi.fn().mockResolvedValue([
                {
                    id: "tenant-1",
                    sessionConfig: {
                        cleanupMode: SessionCleanupMode.Anonymize,
                        ttlSeconds: 3600,
                    },
                },
            ]),
        } as unknown as Repository<TenantEntity>;
        const service = new SessionService(
            sessionRepository,
            tenantRepository,
            {
                getOrThrow: vi.fn((key: string) =>
                    key === "SESSION_TTL" ? 3600 : "full",
                ),
            } as unknown as ConfigService,
            {} as SchedulerRegistry,
            { emit: vi.fn() } as unknown as EventEmitter2,
            {
                getUpDownCounter: vi.fn().mockReturnValue({ add: vi.fn() }),
            } as unknown as MetricService,
        );

        await service.tidyUpSessions();

        const sensitiveValues = queryBuilder.set.mock.calls[0][0];
        expect(Object.keys(sensitiveValues)).toEqual([
            "credentials",
            "credentialPayload",
            "auth_queries",
            "offer",
            "requestObject",
            "responseEncryptionPrivateJwk",
        ]);
        for (const value of Object.values(sensitiveValues)) {
            expect(value()).toBe("NULL");
        }
    });
});
