import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import {
    PostgreSqlContainer,
    StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import request from "supertest";
import { App } from "supertest/types";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { AppModule } from "../src/app.module.js";

/**
 * Boots the full NestJS app on an empty database using migrations only, then
 * verifies the health endpoint responds OK.
 */
describe("Database boot & health", () => {
    describe("SQLite", () => {
        let app: INestApplication<App>;
        let databaseFolder: string;

        beforeAll(async () => {
            databaseFolder = mkdtempSync(join(tmpdir(), "eudiplo-db-boot-"));
            vi.stubEnv("DB_TYPE", "sqlite");
            vi.stubEnv("FOLDER", databaseFolder);
            vi.stubEnv("DB_SYNCHRONIZE", "false");
            vi.stubEnv("DB_MIGRATIONS_RUN", "true");

            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [AppModule],
                },
            ).compile();

            app = moduleFixture.createNestApplication();
            app.useGlobalPipes(new ValidationPipe());
            await app.init();
        }, 30_000);

        afterAll(async () => {
            await app?.close();
            if (databaseFolder) {
                rmSync(databaseFolder, { recursive: true, force: true });
            }
            vi.unstubAllEnvs();
        });

        test("health check returns OK", async () => {
            const res = await request(app.getHttpServer()).get("/health");
            expect(res.status).toBe(200);
            expect(res.body.status).toBe("ok");
        });
    });

    describe("Postgres", () => {
        let app: INestApplication<App>;
        let postgresContainer: StartedPostgreSqlContainer;

        beforeAll(async () => {
            vi.stubEnv("DB_SYNCHRONIZE", "false");
            vi.stubEnv("DB_MIGRATIONS_RUN", "true");
            postgresContainer = await new PostgreSqlContainer("postgres:alpine")
                .withUsername("test_user")
                .withPassword("test_password")
                .withDatabase("test_db")
                .withExposedPorts(5432)
                .start();
            vi.stubEnv("DB_TYPE", "postgres");
            vi.stubEnv("DB_HOST", postgresContainer.getHost());
            vi.stubEnv(
                "DB_PORT",
                postgresContainer.getMappedPort(5432).toString(),
            );
            vi.stubEnv("DB_USERNAME", postgresContainer.getUsername());
            vi.stubEnv("DB_PASSWORD", postgresContainer.getPassword());
            vi.stubEnv("DB_DATABASE", postgresContainer.getDatabase());

            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [AppModule],
                },
            ).compile();

            app = moduleFixture.createNestApplication();
            app.useGlobalPipes(new ValidationPipe());
            await app.init();
        }, 60_000);

        afterAll(async () => {
            await app?.close();
            await postgresContainer?.stop();
            vi.unstubAllEnvs();
        });

        test("health check returns OK", async () => {
            const res = await request(app.getHttpServer()).get("/health");
            expect(res.status).toBe(200);
            expect(res.body.status).toBe("ok");
        });
    });
});
