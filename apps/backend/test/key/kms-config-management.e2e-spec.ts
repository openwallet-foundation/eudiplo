import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { INestApplication } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { AppModule } from "../../src/app.module";
import { createAppValidationPipe } from "../../src/shared/common/zod/zod-schema.util";
import { getToken } from "../utils";

function createTempConfigDir() {
    return mkdtempSync(join(tmpdir(), "eudiplo-kms-config-test-"));
}

describe("Key Chain — KMS configuration management (e2e)", () => {
    let app: INestApplication;
    let authToken: string;
    let tmpConfigDir: string;

    beforeAll(async () => {
        tmpConfigDir = createTempConfigDir();

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    load: [() => ({ CONFIG_FOLDER: tmpConfigDir })],
                }),
                AppModule,
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(createAppValidationPipe());
        await app.init();

        const configService = app.get(ConfigService);
        const clientId = configService.getOrThrow<string>("AUTH_CLIENT_ID");
        const clientSecret =
            configService.getOrThrow<string>("AUTH_CLIENT_SECRET");
        authToken = await getToken(app, clientId, clientSecret);
    });

    afterAll(async () => {
        await app?.close();
    });

    test("accepts and returns a valid tenant KMS configuration", async () => {
        const body = {
            defaultProvider: "vault",
            providers: [
                { id: "db", type: "db" },
                {
                    id: "vault",
                    type: "vault",
                    vaultUrl: "https://vault.example.com",
                    vaultToken: "token",
                },
            ],
        };

        const res = await request(app.getHttpServer())
            .put("/key-chain/providers/config")
            .set("Authorization", `Bearer ${authToken}`)
            .send(body)
            .expect(200);

        expect(res.body.tenantConfig).toMatchObject(body);
        expect(res.body.effectiveConfig).toMatchObject(body);
    });

    test("rejects invalid KMS configurations", async () => {
        await request(app.getHttpServer())
            .put("/key-chain/providers/config")
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                defaultProvider: "missing",
                providers: [
                    { id: "db", type: "db" },
                    {
                        id: "db",
                        type: "vault",
                        vaultUrl: "https://vault.example.com",
                        vaultToken: "token",
                    },
                ],
            })
            .expect(400);
    });
});
