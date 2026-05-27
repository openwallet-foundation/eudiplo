import { readFileSync } from "node:fs";
import https from "node:https";
import { join, resolve } from "node:path";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Test, TestingModule } from "@nestjs/testing";
import * as axios from "axios";
import { Logger } from "nestjs-pino";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { AppModule } from "../../src/app.module";
import { KeyChainService } from "../../src/crypto/key/key-chain.service";
import { getDefaultSecret } from "../utils";
import {
    BACKEND_TEST_CA_PATH,
    OIDF_HTTPD_CA_PATH,
    useOidfContainers,
} from "./oidf-setup";
import { OIDFSuite } from "./oidf-suite";

// Setup OIDF containers for this test file
useOidfContainers();

/**
 * E2E: OIDF conformance runner integration test
 */
describe("OIDF", () => {
    const PUBLIC_DOMAIN =
        import.meta.env.VITE_DOMAIN ?? "host.testcontainers.internal:3000";
    const OIDF_URL = import.meta.env.VITE_OIDF_URL ?? "https://localhost:8443";
    const OIDF_DEMO_TOKEN = import.meta.env.VITE_OIDF_DEMO_TOKEN;
    const ENFORCE_MODULE_COVERAGE_GUARD =
        import.meta.env.VITE_OIDF_ENFORCE_MODULE_COVERAGE === "true";
    const RUN_FULL_MATRIX = import.meta.env.VITE_OIDF_FULL_MATRIX === "true";

    const VERIFIER_VARIANT_MATRIX = [
        {
            credential_format: "sd_jwt_vc",
            client_id_prefix: "x509_hash",
            request_method: "request_uri_signed",
            response_mode: "direct_post.jwt",
        },
        {
            credential_format: "mso_mdoc",
            client_id_prefix: "x509_hash",
            request_method: "request_uri_signed",
            response_mode: "direct_post.jwt",
        },
    ] as const;

    type VerifierVariant = (typeof VERIFIER_VARIANT_MATRIX)[number];

    // Fast mode keeps runtime lower while still validating the primary credential format.
    const ENFORCED_VERIFIER_VARIANTS = RUN_FULL_MATRIX
        ? [...VERIFIER_VARIANT_MATRIX]
        : [VERIFIER_VARIANT_MATRIX[0]];

    // Maps credential_format to the verifier offer requestId for that format.
    const REQUEST_ID_BY_FORMAT: Record<string, string> = {
        sd_jwt_vc: "pid-no-hook",
        mso_mdoc: "pid-mdoc-no-hook",
    };

    let app: INestApplication;
    let authToken: string;
    const createdPlans: Array<{ planId: string; variant: VerifierVariant }> =
        [];

    const axiosBackendInstance = axios.default.create({
        baseURL: "https://localhost:3000",
        httpsAgent: new https.Agent({
            ca: readFileSync(BACKEND_TEST_CA_PATH),
            checkServerIdentity: () => undefined,
        }),
    });

    const oidfSuite = new OIDFSuite(OIDF_URL, OIDF_DEMO_TOKEN);

    beforeAll(async () => {
        // Start the app first so CONFIG_IMPORT runs and key chains are generated
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        // Enable HTTPS with self-signed certificate
        const httpsOptions = {
            key: readFileSync(resolve(__dirname, "../key.pem")),
            cert: readFileSync(resolve(__dirname, "../cert.pem")),
        };

        app = moduleFixture.createNestApplication<NestExpressApplication>({
            httpsOptions,
        });

        // Use Pino logger for all NestJS logging (same as main.ts)
        app.useLogger(app.get(Logger));
        app.useGlobalPipes(new ValidationPipe());

        const configService = app.get(ConfigService);
        const configFolder = resolve(__dirname + "/../fixtures");
        const tmpFolder = resolve(__dirname, "../../../../tmp");
        configService.set("FOLDER", tmpFolder);
        configService.set("CONFIG_FOLDER", configFolder);
        configService.set("PUBLIC_URL", `https://${PUBLIC_DOMAIN}`);
        configService.set("CONFIG_IMPORT", true);
        configService.set("LOG_LEVEL", "debug");

        await app.init();
        await app.listen(3000, "0.0.0.0");

        // Get client credentials
        const client = JSON.parse(
            readFileSync(join(configFolder, "haip/clients/test.json"), "utf-8"),
        );
        const clientId = client.clientId;
        const clientSecret = getDefaultSecret(client.secret);

        // Acquire JWT token using client credentials
        const tokenResponse = await axiosBackendInstance.post<{
            access_token: string;
        }>("/api/oauth2/token", {
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "client_credentials",
        });

        authToken = tokenResponse.data.access_token;
        expect(authToken).toBeDefined();

        // Retrieve the attestation key chain's active (leaf) key and certificate chain.
        // With rotation enabled, the fixture key became root CA and a new leaf key was generated on import.
        const keyChainService = app.get(KeyChainService);
        const attestationEntity = await keyChainService.getEntity(
            "haip",
            "9687a941-3f89-476b-b383-aa5fea1bac8e",
        );

        // Split the certificate chain into base64 DER entries for x5c
        const certPems = attestationEntity.activeCertificate.match(
            /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
        ) ?? [attestationEntity.activeCertificate];
        const x5c = certPems.map((pem) =>
            pem
                .replace("-----BEGIN CERTIFICATE-----", "")
                .replace("-----END CERTIFICATE-----", "")
                .replaceAll(/\r?\n|\r/g, ""),
        );

        // Export the active private key as JWK for the OIDF suite
        const signingJwk = attestationEntity.activeJwk;

        // Create OIDF test plans for each variant with the attestation signing key (matches trust list)
        const planName = "oid4vp-1final-verifier-test-plan";
        const body = {
            alias: "test-plan",
            description: "test plan created via e2e tests",
            credential: {
                signing_jwk: {
                    ...signingJwk,
                    use: "sig",
                    x5c,
                    alg: "ES256",
                },
            },
            publish: "everything",
        };

        for (const variant of ENFORCED_VERIFIER_VARIANTS) {
            const planId = await oidfSuite.createPlan(planName, variant, body);
            createdPlans.push({ planId, variant });
            console.log(
                `Created plan for ${variant.credential_format}: ${OIDF_URL}/plan-detail.html?plan=${planId}`,
            );
        }
    });

    afterAll(async () => {
        for (const { planId } of createdPlans) {
            const outputDir = resolve(
                __dirname,
                `../../../../tmp/oidf-logs/${planId}`,
            );
            await oidfSuite.storeLog(planId, outputDir);
            console.log(`Logs stored in: ${outputDir}`);
        }

        if (app) {
            await app.close();
        }
    });

    // Register one test per variant so the Vitest VS Code plugin shows individual pass/fail.
    // Tests not in ENFORCED_VERIFIER_VARIANTS are registered but skipped (visible in the panel).
    for (const variant of VERIFIER_VARIANT_MATRIX) {
        const isEnforced = ENFORCED_VERIFIER_VARIANTS.some(
            (v) => v.credential_format === variant.credential_format,
        );

        test.skipIf(!isEnforced)(
            `oidf conformance suite presentation [${variant.credential_format}]`,
            async () => {
                const plan = createdPlans.find(
                    (p) =>
                        p.variant.credential_format ===
                        variant.credential_format,
                );
                if (!plan) {
                    throw new Error(
                        `Plan for '${variant.credential_format}' not found in createdPlans`,
                    );
                }

                const testInstance = await oidfSuite.getInstance(plan.planId);
                console.log(
                    `Test details (${variant.credential_format}): ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
                );

                const requestId =
                    REQUEST_ID_BY_FORMAT[variant.credential_format] ??
                    "pid-no-hook";

                // Request presentation URI from backend
                const presentationResponse = await axiosBackendInstance.post<{
                    uri: string;
                    session: string;
                }>(
                    `/verifier/offer`,
                    {
                        response_type: "uri",
                        requestId,
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${authToken}`,
                        },
                    },
                );

                expect(presentationResponse.data.uri).toBeDefined();

                // Extract query parameters from URI (format: openid4vp://...?params)
                const uri = presentationResponse.data.uri;
                const queryStart = uri.indexOf("?");
                if (queryStart === -1) {
                    throw new Error(`URI missing query parameters: ${uri}`);
                }
                const queryString = uri.substring(queryStart);

                // Simulate wallet authorization via OIDF runner
                const authorizeUrl = `${testInstance.url}/authorize${queryString}`;
                await axios.default.get(authorizeUrl, {
                    httpsAgent: new https.Agent({
                        ca: readFileSync(OIDF_HTTPD_CA_PATH),
                        checkServerIdentity: () => undefined,
                    }),
                });

                // Wait for test completion (2s polling delay)
                await new Promise((resolve) => setTimeout(resolve, 2000));

                const result = await oidfSuite.getResult(testInstance.id);
                expect(result).toBe("PASSED");
            },
            10000,
        );
    }

    test("module coverage guard - verifier plan", async () => {
        for (const { planId, variant } of createdPlans) {
            const availableModules = [
                ...new Set(await oidfSuite.getAllTestsModules(planId)),
            ];

            if (!ENFORCE_MODULE_COVERAGE_GUARD) {
                if (availableModules.length > 1) {
                    console.warn(
                        `OIDF verifier coverage guard warning: ${variant.credential_format} plan exposes ${availableModules.length} modules (${availableModules.join(", ")}). Set VITE_OIDF_ENFORCE_MODULE_COVERAGE=true to fail on this.`,
                    );
                }
                continue;
            }

            // Strict mode: guard against plan expansion without adding dedicated tests.
            expect(
                availableModules.length,
                `Verifier ${variant.credential_format} plan contains ${availableModules.length} modules (${availableModules.join(", ")}). Add dedicated tests per new module.`,
            ).toBe(1);
        }
    });
});
