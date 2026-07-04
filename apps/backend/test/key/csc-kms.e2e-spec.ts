import { createSign, createPrivateKey } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

const PROVIDER_ID = "csc-test";
const CSC_CREDENTIAL_ID = "[INTESIQCSEALEC]_SEAL_351_SIGN_1781018892758";
const CSC_USER_ID = "eudiplo_user";
const CSC_PIN = "1123581321";
const CSC_ACCESS_TOKEN = "mock-csc-access-token";
const CSC_SAD = "mock-csc-sad-token";

function readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
    });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
}

function base64UrlOrBase64ToBuffer(value: string): Buffer {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    return Buffer.from(padded, "base64");
}

type RouteHandler = (
    req: IncomingMessage,
    res: ServerResponse,
) => Promise<boolean>;

function buildCscRouteHandlers(input: {
    privateKey: ReturnType<typeof createPrivateKey>;
    certificatePem: string;
}): RouteHandler[] {
    const { privateKey, certificatePem } = input;

    const tokenHandler: RouteHandler = async (req, res) => {
        if (req.method !== "POST" || req.url !== "/oauth2/token") {
            return false;
        }

        const body = new URLSearchParams(await readBody(req));
        if (
            body.get("grant_type") !== "client_credentials" ||
            body.get("client_id") !== "eudiplo-test" ||
            body.get("client_secret") !== "test-secret"
        ) {
            sendJson(res, 401, { error: "invalid_client" });
            return true;
        }

        sendJson(res, 200, {
            access_token: CSC_ACCESS_TOKEN,
            token_type: "Bearer",
            expires_in: 3600,
        });
        return true;
    };

    const listHandler: RouteHandler = async (req, res) => {
        if (req.method !== "POST" || req.url !== "/csc/v2/credentials/list") {
            return false;
        }

        const payload = JSON.parse(await readBody(req)) as { userID?: string };
        if (payload.userID !== CSC_USER_ID) {
            sendJson(res, 400, { error: "invalid_user" });
            return true;
        }

        sendJson(res, 200, { credentialIDs: [CSC_CREDENTIAL_ID] });
        return true;
    };

    const infoHandler: RouteHandler = async (req, res) => {
        if (req.method !== "POST" || req.url !== "/csc/v2/credentials/info") {
            return false;
        }

        const payload = JSON.parse(await readBody(req)) as {
            credentialID?: string;
        };
        if (payload.credentialID !== CSC_CREDENTIAL_ID) {
            sendJson(res, 404, { error: "credential_not_found" });
            return true;
        }

        const certB64 = certificatePem
            .replace("-----BEGIN CERTIFICATE-----", "")
            .replace("-----END CERTIFICATE-----", "")
            .replace(/\s+/g, "");
        sendJson(res, 200, {
            cert: {
                certificates: [certB64],
            },
        });
        return true;
    };

    const authorizeHandler: RouteHandler = async (req, res) => {
        if (
            req.method !== "POST" ||
            req.url !== "/csc/v2/credentials/authorize"
        ) {
            return false;
        }

        const payload = JSON.parse(await readBody(req)) as {
            credentialID?: string;
            authData?: Array<{ id?: string; value?: string }>;
        };
        const pin = payload.authData?.find((a) => a.id === "PIN")?.value;
        if (payload.credentialID !== CSC_CREDENTIAL_ID || pin !== CSC_PIN) {
            sendJson(res, 401, { error: "invalid_auth_data" });
            return true;
        }

        sendJson(res, 200, { SAD: CSC_SAD });
        return true;
    };

    const signHandler: RouteHandler = async (req, res) => {
        if (
            req.method !== "POST" ||
            req.url !== "/csc/v2/signatures/signHash"
        ) {
            return false;
        }

        const payload = JSON.parse(await readBody(req)) as {
            credentialID?: string;
            SAD?: string;
            hashes?: string[];
        };
        if (
            payload.credentialID !== CSC_CREDENTIAL_ID ||
            payload.SAD !== CSC_SAD ||
            !payload.hashes?.[0]
        ) {
            sendJson(res, 400, { error: "invalid_sign_request" });
            return true;
        }

        const digest = base64UrlOrBase64ToBuffer(payload.hashes[0]);
        const signer = createSign("SHA256");
        signer.update(digest);
        signer.end();
        const derSignature = signer.sign(privateKey);

        sendJson(res, 200, {
            signatures: [derSignature.toString("base64")],
        });
        return true;
    };

    return [
        tokenHandler,
        listHandler,
        infoHandler,
        authorizeHandler,
        signHandler,
    ];
}

async function dispatchCscRequest(
    req: IncomingMessage,
    res: ServerResponse,
    handlers: RouteHandler[],
): Promise<void> {
    if (
        req.url !== "/oauth2/token" &&
        req.headers.authorization !== `Bearer ${CSC_ACCESS_TOKEN}`
    ) {
        sendJson(res, 401, { error: "unauthorized" });
        return;
    }

    for (const handler of handlers) {
        if (await handler(req, res)) {
            return;
        }
    }

    sendJson(res, 404, { error: "not_found" });
}

function startCscServer(): Promise<{ server: Server; baseUrl: string }> {
    const privateKeyPem = readFileSync(join(__dirname, "../key.pem"), "utf8");
    const certificatePem = readFileSync(join(__dirname, "../cert.pem"), "utf8");
    const privateKey = createPrivateKey(privateKeyPem);
    const handlers = buildCscRouteHandlers({ privateKey, certificatePem });

    const server = createServer(async (req, res) => {
        try {
            await dispatchCscRequest(req, res, handlers);
        } catch (err) {
            sendJson(res, 500, { error: String(err) });
        }
    });

    return new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address() as AddressInfo;
            resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
        });
    });
}

describe("Key Chain - CSC KMS adapter (e2e)", () => {
    let cscServer: Server;
    let app: INestApplication;
    let authToken: string;

    beforeAll(async () => {
        const { server, baseUrl } = await startCscServer();
        cscServer = server;

        const tmpConfigDir = mkdtempSync(
            join(tmpdir(), "eudiplo-csc-kms-test-"),
        );
        writeFileSync(
            join(tmpConfigDir, "kms.json"),
            JSON.stringify({
                defaultProvider: PROVIDER_ID,
                providers: [
                    { id: "db", type: "db" },
                    {
                        id: PROVIDER_ID,
                        type: "csc",
                        baseUrl,
                        tokenUrl: `${baseUrl}/oauth2/token`,
                        clientId: "eudiplo-test",
                        clientSecret: "test-secret",
                        scope: "service",
                        userId: CSC_USER_ID,
                        useAuthorizeEndpoint: true,
                        authorizeAuthData: [
                            {
                                id: "PIN",
                                value: CSC_PIN,
                            },
                        ],
                    },
                ],
            }),
        );

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
        await new Promise<void>((resolve) => cscServer?.close(() => resolve()));
    });

    test("csc provider is listed with expected capabilities", async () => {
        const res = await request(app.getHttpServer())
            .get("/key-chain/providers")
            .set("Authorization", `Bearer ${authToken}`)
            .expect(200);

        const provider = res.body.providers.find(
            (p: { name: string }) => p.name === PROVIDER_ID,
        );

        expect(provider).toBeDefined();
        expect(provider.type).toBe("csc");
        expect(provider.capabilities.canCreate).toBe(true);
        expect(provider.capabilities.canImport).toBe(false);
        expect(provider.capabilities.canDelete).toBe(false);
    });

    test("csc provider health check passes", async () => {
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

    test("create key chain with CSC provider", async () => {
        const createRes = await request(app.getHttpServer())
            .post("/key-chain")
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                type: KeyChainType.Standalone,
                usageType: "access",
                kmsProvider: PROVIDER_ID,
                description: "csc kms e2e test",
            })
            .expect(201);

        const keyChainId: string = createRes.body.id;
        expect(keyChainId).toBeDefined();

        const keyRes = await request(app.getHttpServer())
            .get(`/key-chain/${keyChainId}`)
            .set("Authorization", `Bearer ${authToken}`)
            .expect(200);

        expect(keyRes.body.kmsProvider).toBe(PROVIDER_ID);
        expect(keyRes.body.activePublicKey.kty).toBe("EC");

        expect(keyRes.body.activeCertificate).toBeDefined();
    });
});
