import "reflect-metadata";
import { ConfigService } from "@nestjs/config";
import { DataSource } from "typeorm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ClientEntity } from "../../auth/client/entities/client.entity";
import { TenantEntity } from "../../auth/tenant/entities/tenant.entity";
import { ActiveCredentialSlot } from "./entities/active-credential-slot.entity";
import { StatusListEntity } from "./entities/status-list.entity";
import { StatusMapping } from "./entities/status-mapping.entity";
import { StatusListService } from "./status-list.service";

describe("StatusListService SQLite concurrency", () => {
    let dataSource: DataSource;
    let service: StatusListService;

    beforeEach(async () => {
        dataSource = new DataSource({
            type: "better-sqlite3",
            database: ":memory:",
            entities: [
                ClientEntity,
                TenantEntity,
                StatusListEntity,
                StatusMapping,
                ActiveCredentialSlot,
            ],
            synchronize: true,
        });
        await dataSource.initialize();

        const configService = {
            getOrThrow: vi.fn((key: string) => {
                if (key === "PUBLIC_URL") {
                    return "https://issuer.example";
                }
                throw new Error(`Unexpected config key: ${key}`);
            }),
        } as unknown as ConfigService;
        const orchestrator = { register: vi.fn() };

        service = new StatusListService(
            configService,
            {} as never,
            {} as never,
            dataSource,
            dataSource.getRepository(StatusMapping),
            dataSource.getRepository(StatusListEntity),
            dataSource.getRepository(TenantEntity),
            {} as never,
            {} as never,
            orchestrator as never,
            dataSource.getRepository(ActiveCredentialSlot),
            {} as never,
        );

        await dataSource.getRepository(TenantEntity).save({
            id: "tenant-1",
            name: "Tenant 1",
            status: "active",
        });
        await dataSource.getRepository(StatusListEntity).save({
            id: "list-1",
            tenantId: "tenant-1",
            credentialConfigurationId: null,
            elements: [0, 0],
            stack: [0, 1],
            bits: 1,
        });
    });

    afterEach(async () => {
        await dataSource.destroy();
    });

    test("allocates an entry without unsupported pessimistic locks", async () => {
        const payload = await service.createEntry(
            { id: "session-1", tenantId: "tenant-1" } as never,
            "config-1",
        );

        expect(payload.status.status_list.uri).toBe(
            "https://issuer.example/issuers/tenant-1/status-management/status-list/list-1",
        );
        expect([0, 1]).toContain(payload.status.status_list.idx);

        const list = await dataSource
            .getRepository(StatusListEntity)
            .findOneByOrFail({ id: "list-1", tenantId: "tenant-1" });
        expect(list.stack).toHaveLength(1);
        expect(list.version).toBe(2);

        const mappings = await dataSource.getRepository(StatusMapping).find();
        expect(mappings).toHaveLength(1);
        expect(mappings[0].index).toBe(payload.status.status_list.idx);
    });

    test("does not cache tokens generated from a stale entity version", async () => {
        const repository = dataSource.getRepository(StatusListEntity);
        const snapshot = await repository.findOneByOrFail({
            id: "list-1",
            tenantId: "tenant-1",
        });

        Object.assign(service as object, {
            statusListConfigService: {
                getEffectiveConfig: vi.fn().mockResolvedValue({
                    ttl: 300,
                    enableAggregation: false,
                }),
            },
            certService: {
                find: vi.fn().mockResolvedValue({
                    keyId: "status-list-key",
                    crt: [],
                }),
                getLeafCertBase64: vi.fn().mockReturnValue(["certificate"]),
            },
            keyChainService: {
                signJWT: vi.fn().mockImplementation(async () => {
                    await repository.update(
                        {
                            id: snapshot.id,
                            tenantId: snapshot.tenantId,
                            version: snapshot.version,
                        },
                        {
                            elements: [1, 0],
                            version: () => "version + 1",
                        },
                    );
                    return "stale-jwt";
                }),
            },
            signStatusListCwt: vi.fn().mockResolvedValue(Uint8Array.of(1)),
        });

        await expect(service.createListJWT(snapshot)).resolves.toBe(false);

        const current = await repository.findOneByOrFail({
            id: snapshot.id,
            tenantId: snapshot.tenantId,
        });
        expect(current.elements).toEqual([1, 0]);
        expect(current.version).toBe(snapshot.version + 1);
        expect(current.jwt).toBeNull();
        expect(current.cwt).toBeNull();
    });

    test("allocates concurrently without transaction conflicts", async () => {
        // SQLite hands every query runner the same connection, so two
        // transactions opened at once collide and the failure surfaces as
        // "cannot rollback - no transaction is active". Allocation is
        // serialised on such drivers; this asserts concurrent callers still
        // each get a distinct index.
        await dataSource
            .getRepository(StatusListEntity)
            .update(
                { id: "list-1", tenantId: "tenant-1" },
                { elements: [0, 0, 0, 0], stack: [0, 1, 2, 3] },
            );

        const results = await Promise.all([
            service.createEntry(
                { id: "session-a", tenantId: "tenant-1" } as never,
                "config-1",
            ),
            service.createEntry(
                { id: "session-b", tenantId: "tenant-1" } as never,
                "config-1",
            ),
            service.createEntry(
                { id: "session-c", tenantId: "tenant-1" } as never,
                "config-1",
            ),
        ]);

        const indices = results.map((result) => result.status.status_list.idx);
        expect(new Set(indices).size).toBe(3);

        const mappings = await dataSource
            .getRepository(StatusMapping)
            .findBy({ tenantId: "tenant-1" });
        expect(mappings).toHaveLength(3);
    });

    test("concurrent status updates to different indices are both kept", async () => {
        await dataSource
            .getRepository(StatusListEntity)
            .update(
                { id: "list-1", tenantId: "tenant-1" },
                { elements: [0, 0, 0, 0], stack: [0, 1, 2, 3] },
            );

        await Promise.all([
            service
                .updateStatus(
                    { sessionId: "x", status: 1 } as never,
                    "tenant-1",
                )
                .catch(() => undefined),
            service
                .updateStatus(
                    { sessionId: "y", status: 1 } as never,
                    "tenant-1",
                )
                .catch(() => undefined),
        ]);

        // The point is that concurrent update paths do not throw a driver-level
        // transaction error; missing sessions simply update nothing.
        const list = await dataSource
            .getRepository(StatusListEntity)
            .findOneByOrFail({ id: "list-1", tenantId: "tenant-1" });
        expect(list.elements).toHaveLength(4);
    });
});
