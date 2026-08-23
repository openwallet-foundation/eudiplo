import { DataSource } from "typeorm";
import { afterEach, describe, expect, test } from "vitest";
import { AddConfigResourceMetadata1777000000000 } from "./migrations/1777000000000-AddConfigResourceMetadata";

describe("AddConfigResourceMetadata1777000000000", () => {
    let dataSource: DataSource | undefined;

    afterEach(async () => {
        await dataSource?.destroy();
        dataSource = undefined;
    });

    test("creates the ownership table idempotently on SQLite", async () => {
        dataSource = new DataSource({
            type: "better-sqlite3",
            database: ":memory:",
        });
        await dataSource.initialize();
        const queryRunner = dataSource.createQueryRunner();
        const migration = new AddConfigResourceMetadata1777000000000();

        await migration.up(queryRunner);
        await migration.up(queryRunner);
        await queryRunner.query(`
            INSERT INTO "config_resource_metadata"
                ("tenantId", "kind", "resourceId", "ownership", "generation")
            VALUES ('tenant-a', 'KeyChain', 'issuer', 'file-managed', 4)
        `);

        expect(
            await queryRunner.query(`
                SELECT "ownership", "generation"
                FROM "config_resource_metadata"
                WHERE "tenantId" = 'tenant-a'
            `),
        ).toEqual([{ ownership: "file-managed", generation: 4 }]);
        const table = await queryRunner.getTable("config_resource_metadata");
        expect(table?.primaryColumns.map((column) => column.name)).toEqual([
            "tenantId",
            "kind",
            "resourceId",
        ]);
        expect(
            table?.indices.some(
                (index) =>
                    index.name ===
                    "IDX_config_resource_metadata_tenant_ownership",
            ),
        ).toBe(true);

        await migration.down(queryRunner);
        expect(await queryRunner.hasTable("config_resource_metadata")).toBe(
            false,
        );
        await queryRunner.release();
    });
});
