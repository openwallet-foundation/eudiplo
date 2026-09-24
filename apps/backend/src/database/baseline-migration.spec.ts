import { DataSource, EntitySchema } from "typeorm";
import { afterEach, describe, expect, test } from "vitest";
import { BaselineMigration1740000000000 } from "./migrations/1740000000000-BaselineMigration.js";

const ExampleEntity = new EntitySchema({
    name: "Example",
    tableName: "example_entity",
    columns: {
        id: {
            type: String,
            primary: true,
        },
        value: {
            type: String,
        },
    },
});

describe("BaselineMigration1740000000000", () => {
    let dataSource: DataSource | undefined;

    afterEach(async () => {
        if (dataSource?.isInitialized) await dataSource.destroy();
    });

    test("creates the entity schema on a fresh database", async () => {
        dataSource = new DataSource({
            type: "better-sqlite3",
            database: ":memory:",
            entities: [ExampleEntity],
            migrations: [BaselineMigration1740000000000],
            migrationsTableName: "typeorm_migrations",
            synchronize: false,
        });
        await dataSource.initialize();

        await dataSource.runMigrations();

        await expect(
            dataSource.query("SELECT * FROM example_entity"),
        ).resolves.toEqual([]);
        await expect(
            dataSource.query("SELECT * FROM typeorm_migrations"),
        ).resolves.toHaveLength(1);
    });

    test("leaves an existing schema and its data untouched", async () => {
        dataSource = new DataSource({
            type: "better-sqlite3",
            database: ":memory:",
            entities: [ExampleEntity],
            migrations: [BaselineMigration1740000000000],
            migrationsTableName: "typeorm_migrations",
            synchronize: false,
        });
        await dataSource.initialize();
        await dataSource.query(
            'CREATE TABLE "legacy_entity" ("id" varchar PRIMARY KEY, "value" varchar NOT NULL)',
        );
        await dataSource.query(
            'INSERT INTO "legacy_entity" ("id", "value") VALUES (?, ?)',
            ["existing", "keep-me"],
        );

        await dataSource.runMigrations();

        await expect(
            dataSource.query("SELECT * FROM legacy_entity"),
        ).resolves.toEqual([{ id: "existing", value: "keep-me" }]);
        await expect(
            dataSource.query("SELECT * FROM example_entity"),
        ).rejects.toThrow();
    });
});
