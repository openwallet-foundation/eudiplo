import { webcrypto } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import {
    type IncomingMessage,
    type Server,
    type ServerResponse,
    createServer,
} from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { AppModule } from "../../src/app.module";
import { KeyChainType } from "../../src/crypto/key/dto/key-chain-create.dto";
import { getToken } from "../utils";

const PROVIDER_ID = "kms-reference";

// ---------------------------------------------------------------------------
// Minimal in-process HTTP KMS server
// Implements the same API contract as apps/kms-reference without any external
// process dependency, so the test is fast, portable, and port-conflict-free.
// ---------------------------------------------------------------------------

const subtle = webcrypto.subtle;

interface StoredKey {
    pair: webcrypto.CryptoKeyPair;
    alg: string;
}

function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
    });
}

function json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}

async function kmsHandler(
    req: IncomingMessage,
    res: ServerResponse,
    keyStore: Map<string, StoredKey>,
): Promise<void> {
    const parts = (req.url ?? "/").split("/").filter(Boolean);

    try {
        // GET /health
        if (
            req.method === "GET" &&
            parts.length === 1 &&
            parts[0] === "health"
        ) {
            json(res, 200, { ok: true, keyCount: keyStore.size });
            return;
        }

        // POST /keys — generate a new ECDSA P-256 key
        if (
            req.method === "POST" &&
            parts.length === 1 &&
            parts[0] === "keys"
        ) {
            const { kid, alg } = JSON.parse(await readBody(req)) as {
                kid: string;
                alg: string;
            };
            const pair = await subtle.generateKey(
                { name: "ECDSA", namedCurve: "P-256" },
                true,
                ["sign", "verify"],
            );
            keyStore.set(kid, { pair, alg });
            const publicJwk = await subtle.exportKey("jwk", pair.publicKey);
            json(res, 200, { publicJwk: { ...publicJwk, kid, alg: "ES256" } });
            return;
        }

        // POST /keys/:kid/sign
        if (
            req.method === "POST" &&
            parts.length === 3 &&
            parts[0] === "keys" &&
            parts[2] === "sign"
        ) {
            const kid = parts[1];
            const stored = keyStore.get(kid);
            if (!stored) {
                json(res, 404, { error: "Key not found" });
                return;
            }
            const { data } = JSON.parse(await readBody(req)) as {
                data: string;
            };
            const sigBuf = await subtle.sign(
                { name: "ECDSA", hash: "SHA-256" },
                stored.pair.privateKey,
                Buffer.from(data, "base64"),
            );
            json(res, 200, {
                signature: Buffer.from(sigBuf).toString("base64url"),
            });
            return;
        }

        // POST /keys/:kid/import
        if (
            req.method === "POST" &&
            parts.length === 3 &&
            parts[0] === "keys" &&
            parts[2] === "import"
        ) {
            const kid = parts[1];
            const { privateJwk, alg } = JSON.parse(await readBody(req)) as {
                privateJwk: JsonWebKey;
                alg: string;
            };
            const privateKey = await subtle.importKey(
                "jwk",
                privateJwk,
                { name: "ECDSA", namedCurve: "P-256" },
                true,
                ["sign"],
            );
            const pubJwk = { ...privateJwk } as JsonWebKey & { d?: string };
            delete pubJwk.d;
            const publicKey = await subtle.importKey(
                "jwk",
                pubJwk,
                { name: "ECDSA", namedCurve: "P-256" },
                true,
                ["verify"],
            );
            keyStore.set(kid, { pair: { privateKey, publicKey }, alg });
            const exportedPub = await subtle.exportKey("jwk", publicKey);
            json(res, 200, {
                publicJwk: { ...exportedPub, kid, alg: "ES256" },
            });
            return;
        }

        // DELETE /keys/:kid
        if (
            req.method === "DELETE" &&
            parts.length === 2 &&
            parts[0] === "keys"
        ) {
            keyStore.delete(parts[1]);
            res.writeHead(204);
            res.end();
            return;
        }

        json(res, 404, { error: "Not found" });
    } catch (err) {
        json(res, 500, { error: String(err) });
    }
}

function startKmsServer(): Promise<{ server: Server; baseUrl: string }> {
    const keyStore = new Map<string, StoredKey>();
    const server = createServer(
        (req, res) => void kmsHandler(req, res, keyStore),
    );
    return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address() as AddressInfo;
            resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
        });
    });
}

// ---------------------------------------------------------------------------

describe("Key Chain — HTTP KMS adapter (e2e)", () => {
    let kmsServer: Server;
    let app: INestApplication;
    let authToken: string;

    beforeAll(async () => {
        // 1. Start the in-process KMS server on a random OS-assigned port
        const { server, baseUrl } = await startKmsServer();
        kmsServer = server;

        // 2. Write a temp kms.json pointing at the running server
        const tmpConfigDir = mkdtempSync(
            join(tmpdir(), "eudiplo-http-kms-test-"),
        );
        writeFileSync(
            join(tmpConfigDir, "kms.json"),
            JSON.stringify({
                defaultProvider: PROVIDER_ID,
                providers: [
                    { id: "db", type: "db" },
                    {
                        id: PROVIDER_ID,
                        type: "http",
                        baseUrl,
                        canImport: true,
                    },
                ],
            }),
        );

        // 3. Boot the NestJS app with CONFIG_FOLDER pointing at our temp dir
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
        app.useGlobalPipes(new ValidationPipe());
        await app.init();

        const configService = app.get(ConfigService);
        const clientId = configService.getOrThrow<string>("AUTH_CLIENT_ID");
        const clientSecret =
            configService.getOrThrow<string>("AUTH_CLIENT_SECRET");
        authToken = await getToken(app, clientId, clientSecret);
    });

    afterAll(async () => {
        await app?.close();
        await new Promise<void>((resolve) => kmsServer?.close(() => resolve()));
    });

    test("http provider is listed with correct capabilities", async () => {
        const res = await request(app.getHttpServer())
            .get("/key-chain/providers")
            .set("Authorization", `Bearer ${authToken}`)
            .expect(200);

        const provider = res.body.providers.find(
            (p: { name: string }) => p.name === PROVIDER_ID,
        );
        expect(provider).toBeDefined();
        expect(provider.capabilities.canCreate).toBe(true);
        expect(provider.capabilities.canImport).toBe(true);
        expect(provider.capabilities.canDelete).toBe(true);
    });

    test("http provider health check passes", async () => {
        const res = await request(app.getHttpServer())
            .get("/key-chain/providers/health")
            .set("Authorization", `Bearer ${authToken}`)
            .expect(200);

        const providerHealth = res.body.find(
            (p: { providerId: string }) => p.providerId === PROVIDER_ID,
        );
        expect(providerHealth).toBeDefined();
        expect(providerHealth.ok).toBe(true);
    });

    test("create → get → list → delete key chain via http kms", async () => {
        // Create
        const createRes = await request(app.getHttpServer())
            .post("/key-chain")
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                type: KeyChainType.Standalone,
                usageType: "access",
                kmsProvider: PROVIDER_ID,
                description: "http kms e2e test key chain",
            })
            .expect(201);

        const keyChainId: string = createRes.body.id;
        expect(keyChainId).toBeDefined();

        // Get by ID
        const getRes = await request(app.getHttpServer())
            .get(`/key-chain/${keyChainId}`)
            .set("Authorization", `Bearer ${authToken}`)
            .expect(200);

        expect(getRes.body.id).toBe(keyChainId);
        expect(getRes.body.kmsProvider).toBe(PROVIDER_ID);

        // Should appear in list
        const listRes = await request(app.getHttpServer())
            .get("/key-chain")
            .set("Authorization", `Bearer ${authToken}`)
            .expect(200);

        expect(
            listRes.body.find((k: { id: string }) => k.id === keyChainId),
        ).toBeDefined();

        // Delete
        await request(app.getHttpServer())
            .delete(`/key-chain/${keyChainId}`)
            .set("Authorization", `Bearer ${authToken}`)
            .expect(200);

        // Confirm gone
        await request(app.getHttpServer())
            .get(`/key-chain/${keyChainId}`)
            .set("Authorization", `Bearer ${authToken}`)
            .expect(404);
    });
});
