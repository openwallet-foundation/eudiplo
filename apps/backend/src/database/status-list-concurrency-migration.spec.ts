import { DataSource } from "typeorm";
import { afterEach, describe, expect, test } from "vitest";
import { AddStatusListVersionAndUniqueConstraint1776000000000 } from "./migrations/1776000000000-AddStatusListVersionAndUniqueConstraint";

describe("AddStatusListVersionAndUniqueConstraint1776000000000", () => {
    let dataSource: DataSource | undefined;

    afterEach(async () => {
        await dataSource?.destroy();
        dataSource = undefined;
    });

    test.each(["status_list_entity", "status_list"])(
        "migrates the %s table on SQLite",
        async (statusListTableName) => {
            dataSource = new DataSource({
                type: "better-sqlite3",
                database: ":memory:",
            });
            await dataSource.initialize();

            const queryRunner = dataSource.createQueryRunner();
            await queryRunner.query(`
                CREATE TABLE "${statusListTableName}" (
                    "id" varchar NOT NULL,
                    "tenantId" varchar NOT NULL,
                    PRIMARY KEY ("id", "tenantId")
                )
            `);
            await queryRunner.query(`
                CREATE TABLE "status_mapping" (
                    "tenantId" varchar NOT NULL,
                    "sessionId" varchar NOT NULL,
                    "statusListId" varchar NOT NULL,
                    "index" integer NOT NULL,
                    "credentialConfigurationId" varchar NOT NULL,
                    "list" varchar NOT NULL,
                    PRIMARY KEY (
                        "tenantId",
                        "sessionId",
                        "statusListId",
                        "index",
                        "credentialConfigurationId"
                    )
                )
            `);
            await queryRunner.query(
                `INSERT INTO "${statusListTableName}" ("id", "tenantId") VALUES ('list-1', 'tenant-1')`,
            );
            await queryRunner.query(`
                INSERT INTO "status_mapping"
                    ("tenantId", "sessionId", "statusListId", "index", "credentialConfigurationId", "list")
                VALUES ('tenant-1', 'session-1', 'list-1', 1, 'config-1', 'uri')
            `);

            const migration =
                new AddStatusListVersionAndUniqueConstraint1776000000000();
            await migration.up(queryRunner);
            await migration.up(queryRunner);

            const rows = await queryRunner.query(
                `SELECT "version" FROM "${statusListTableName}"`,
            );
            expect(rows).toEqual([{ version: 1 }]);

            await expect(
                queryRunner.query(`
                    INSERT INTO "status_mapping"
                        ("tenantId", "sessionId", "statusListId", "index", "credentialConfigurationId", "list")
                    VALUES ('tenant-1', 'session-2', 'list-1', 1, 'config-2', 'uri')
                `),
            ).rejects.toThrow(/UNIQUE constraint failed/);

            await queryRunner.release();
        },
    );
});
