import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import {
    PostgreSqlContainer,
    StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import request from "supertest";
import { App } from "supertest/types";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { AppModule } from "../src/app.module.js";

/**
 * Boots the full NestJS app with synchronize + migrations enabled,
 * then verifies the health endpoint responds OK.
 */
describe("Database boot & health", () => {
    describe("SQLite", () => {
        let app: INestApplication<App>;

        beforeAll(async () => {
            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [
                        ConfigModule.forRoot({
                            isGlobal: true,
                            load: [
                                () => ({
                                    DB_TYPE: "sqlite",
                                    DB_SYNCHRONIZE: "true",
                                    DB_MIGRATIONS_RUN: "true",
                                }),
                            ],
                        }),
                        AppModule,
                    ],
                },
            ).compile();

            app = moduleFixture.createNestApplication();
            app.useGlobalPipes(new ValidationPipe());
            await app.init();
        }, 30_000);

        afterAll(async () => {
            await app?.close();
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
            postgresContainer = await new PostgreSqlContainer("postgres:alpine")
                .withUsername("test_user")
                .withPassword("test_password")
                .withDatabase("test_db")
                .withExposedPorts(5432)
                .start();

            const moduleFixture: TestingModule = await Test.createTestingModule(
                {
                    imports: [
                        ConfigModule.forRoot({
                            isGlobal: true,
                            load: [
                                () => ({
                                    DB_TYPE: "postgres",
                                    DB_HOST: postgresContainer.getHost(),
                                    DB_PORT: postgresContainer
                                        .getMappedPort(5432)
                                        .toString(),
                                    DB_USERNAME:
                                        postgresContainer.getUsername(),
                                    DB_PASSWORD:
                                        postgresContainer.getPassword(),
                                    DB_DATABASE:
                                        postgresContainer.getDatabase(),
                                    DB_SYNCHRONIZE: "true",
                                    DB_MIGRATIONS_RUN: "true",
                                }),
                            ],
                        }),
                        AppModule,
                    ],
                },
            ).compile();

            app = moduleFixture.createNestApplication();
            app.useGlobalPipes(new ValidationPipe());
            await app.init();
        }, 60_000);

        afterAll(async () => {
            await app?.close();
            await postgresContainer?.stop();
        });

        test("health check returns OK", async () => {
            const res = await request(app.getHttpServer()).get("/health");
            expect(res.status).toBe(200);
            expect(res.body.status).toBe("ok");
        });
    });
});
