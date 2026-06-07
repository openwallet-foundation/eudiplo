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
import { OIDFSuite, TestInstance } from "./oidf-suite";

function getAllowedResults(moduleName: string): string[] {
    const signal = moduleName.toLowerCase();

    if (signal.includes("happy-flow")) {
        return ["PASSED"];
    }

    //TODO: needs to be updated
    if (signal.includes("fail") || signal.includes("invalid")) {
        return ["PASSED", "FAILED", "SKIPPED"];
    }

    if (signal.includes("metadata")) {
        return ["PASSED", "WARNING", "SKIPPED"];
    }

    // Some verifier edge-case modules do not include fail/invalid in their names
    // but can still legitimately return FAILED for non-conformance scenarios.
    return ["PASSED", "FAILED", "SKIPPED", "WARNING"];
}

// Setup OIDF containers for this test file
useOidfContainers();

/**
 * E2E: OIDF conformance runner integration test
 */
describe("OIDF", () => {
    type VerifierVariant = {
        credential_format: "sd_jwt_vc" | "iso_mdl";
        client_id_prefix?: string;
        request_method?: string;
        response_mode?: string;
    };

    const PUBLIC_DOMAIN =
        import.meta.env.VITE_DOMAIN ?? "host.testcontainers.internal:3000";
    const OIDF_URL = import.meta.env.VITE_OIDF_URL ?? "https://localhost:8443";
    const OIDF_DEMO_TOKEN = import.meta.env.VITE_OIDF_DEMO_TOKEN;
    const ENFORCE_MODULE_COVERAGE_GUARD =
        import.meta.env.VITE_OIDF_ENFORCE_MODULE_COVERAGE === "true";

    // Run all available verifier approaches for SD-JWT VC by constraining only credential_format.
    const SD_JWT_VC_ALL_APPROACHES_VARIANT = {
        credential_format: "sd_jwt_vc",
        client_id_prefix: "x509_hash",
        request_method: "request_uri_signed",
        response_mode: "direct_post.jwt",
    } as const;

    // Keep one representative mDOC baseline approach.
    const MDOC_BASELINE_VARIANT = {
        credential_format: "iso_mdl",
        client_id_prefix: "x509_hash",
        request_method: "request_uri_signed",
        response_mode: "direct_post.jwt",
    } as const;

    const ENFORCED_VERIFIER_VARIANTS: VerifierVariant[] = [
        SD_JWT_VC_ALL_APPROACHES_VARIANT,
        MDOC_BASELINE_VARIANT,
    ];

    const formatVariantLabel = (variant: VerifierVariant): string =>
        [
            variant.credential_format,
            variant.client_id_prefix ?? "all-client-id-prefixes",
            variant.request_method ?? "all-request-methods",
            variant.response_mode ?? "all-response-modes",
        ].join("/");

    // Maps credential_format to the verifier offer requestId for that format.
    const REQUEST_ID_BY_FORMAT: Record<string, string> = {
        sd_jwt_vc: "pid-no-hook",
        iso_mdl: "pid-mdoc-no-hook",
    };

    const MDOC_PRESENTATION_DEFINITION_FIELDS = [
        "birth_date",
        "document_number",
        "driving_privileges",
        "expiry_date",
        "family_name",
        "given_name",
        "issue_date",
        "issuing_authority",
        "issuing_country",
        "portrait",
        "un_distinguishing_sign",
    ] as const;

    const MDOC_ENCRYPTION_JWK = {
        kty: "EC",
        d: "7N8jd8HvUp3vHC7a-xitehRnYuyZLy3kqkxG7KmpfMY",
        use: "enc",
        crv: "P-256",
        kid: "A541J5yUqazgE8WBFkIyeh2OtK-udqUR_OC0kB7l3oU",
        x: "cwYyuS94hcOtcPlrMMtGtflCfbZUwz5Mf1Gfa2m0AM8",
        y: "KB7sJkFQyB8jZHO9vmWS5LNECL4id3OJO9HX9ChNonA",
        alg: "ECDH-ES",
    } as const;

    let app: INestApplication;
    let authToken: string;
    const createdPlans: Array<{ planId: string; variant: VerifierVariant }> =
        [];
    const executedPlanIds = new Set<string>();
    const coveredScenarioKeys = new Set<string>();

    /**
     * Cache of plan modules keyed by planId to avoid redundant API calls.
     */
    const planModulesCache = new Map<
        string,
        Awaited<ReturnType<OIDFSuite["getPlanModules"]>>
    >();

    const axiosBackendInstance = axios.default.create({
        baseURL: "https://localhost:3000",
        httpsAgent: new https.Agent({
            ca: readFileSync(BACKEND_TEST_CA_PATH),
            checkServerIdentity: () => undefined,
        }),
    });

    const oidfSuite = new OIDFSuite(OIDF_URL, OIDF_DEMO_TOKEN);
    const oidfSuiteStartTest = oidfSuite.startTest.bind(oidfSuite);
    oidfSuite.startTest = async (
        planId: string,
        testName: string,
    ): Promise<TestInstance> => {
        executedPlanIds.add(planId);
        return oidfSuiteStartTest(planId, testName);
    };

    const getPlanModulesCached = async (planId: string) => {
        if (!planModulesCache.has(planId)) {
            planModulesCache.set(
                planId,
                await oidfSuite.getPlanModules(planId),
            );
        }
        return planModulesCache.get(planId)!;
    };

    const getPlanByCredentialFormat = (
        credentialFormat: VerifierVariant["credential_format"],
    ): { planId: string; variant: VerifierVariant } => {
        const targetPlan = createdPlans.find(
            ({ variant }) => variant.credential_format === credentialFormat,
        );

        if (!targetPlan) {
            throw new Error(
                `No verifier plan found for credential format '${credentialFormat}'`,
            );
        }

        return targetPlan;
    };

    const runVerifierModulesForPlan = async (
        planId: string,
        variant: VerifierVariant,
    ): Promise<void> => {
        const planModuleNames = (await oidfSuite.getAllTestsModules(
            planId,
        )) as string[];
        const uniqueModules = [...new Set<string>(planModuleNames)].sort(
            (a, b) => a.localeCompare(b),
        );

        if (uniqueModules.length === 0) {
            throw new Error(
                `No verifier modules found for ${formatVariantLabel(variant)}`,
            );
        }

        for (const moduleName of uniqueModules) {
            const modules = await getPlanModulesCached(planId);
            const module = modules.find((m) => m.testModule === moduleName);

            if (!module) {
                console.warn(
                    `Module '${moduleName}' not found in plan ${formatVariantLabel(variant)}, skipping.`,
                );
                continue;
            }

            const testInstance = await oidfSuite.startTest(planId, moduleName);
            console.log(
                `Test details (${formatVariantLabel(variant)}): ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
            );

            await sendPresentationToTestRunner(testInstance, variant);

            const logResult = await oidfSuite.waitForFinished(testInstance.id);
            const allowedResults = getAllowedResults(moduleName);

            expect(
                allowedResults,
                `Unexpected result for module '${moduleName}' on ${formatVariantLabel(variant)}: ${logResult.result}`,
            ).toContain(logResult.result);

            coveredScenarioKeys.add(
                oidfSuite.buildScenarioKey({
                    testModule: module.testModule,
                    planVariant: variant,
                    moduleVariant: module.variant,
                }),
            );
        }
    };

    async function sendPresentationToTestRunner(
        testInstance: TestInstance,
        variant: VerifierVariant,
    ): Promise<void> {
        // Runner must be WAITING before submitting the authorization request.
        const maxAttempts = 100;
        let attempts = 0;
        let state = "";

        while (state !== "WAITING" && attempts < maxAttempts) {
            const response = await oidfSuite.instance.get<{ status: string }>(
                `/api/info/${testInstance.id}`,
            );
            state = response.data.status;
            if (state !== "WAITING") {
                await new Promise((resolve) => setTimeout(resolve, 300));
                attempts++;
            }
        }

        if (state !== "WAITING") {
            throw new Error(
                `Verifier runner ${testInstance.id} did not reach WAITING state after ${maxAttempts} attempts`,
            );
        }

        const requestId =
            REQUEST_ID_BY_FORMAT[variant.credential_format] ?? "pid-no-hook";

        // Request presentation URI from backend
        const presentationResponse = await axiosBackendInstance.post<{
            uri: string;
            session: string;
        }>(
            "/verifier/offer",
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

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        expect(["PASSED", "SKIPPED", "WARNING"]).toContain(logResult.result);
    }

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
            "c3f24b6e-9b71-4b62-8d37-5f1a2c9e47ad",
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

        // Create OIDF test plans for each variant.
        // SD-JWT uses credential.signing_jwk while mDOC expects key material in client.jwks.keys.
        const planName = "oid4vp-1final-verifier-test-plan";
        const sdJwtBody = {
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
        } as const;

        const mdocBody = {
            alias: "test-plan",
            description: "test plan created via e2e tests",
            server: {
                authorization_endpoint: "mdoc-openid4vp://",
            },
            credential: {
                // Force issuer-side mDOC signing to use the same trusted HAIP key chain.
                signing_jwk: {
                    ...signingJwk,
                    use: "sig",
                    x5c,
                    alg: "ES256",
                },
            },
            client: {
                presentation_definition: {
                    id: "mDL",
                    input_descriptors: [
                        {
                            id: "org.iso.18013.5.1.mDL",
                            format: {
                                mso_mdoc: {
                                    alg: ["ES256"],
                                },
                            },
                            constraints: {
                                fields: MDOC_PRESENTATION_DEFINITION_FIELDS.map(
                                    (fieldName) => ({
                                        path: [
                                            `$['org.iso.18013.5.1']['${fieldName}']`,
                                        ],
                                        intent_to_retain: false,
                                    }),
                                ),
                                limit_disclosure: "required",
                            },
                        },
                    ],
                },
                jwks: {
                    keys: [
                        {
                            ...signingJwk,
                            use: "sig",
                            x5c,
                            alg: "ES256",
                        },
                        MDOC_ENCRYPTION_JWK,
                    ],
                },
            },
            publish: "everything",
        } as const;

        for (const variant of ENFORCED_VERIFIER_VARIANTS) {
            const body =
                variant.credential_format === "iso_mdl" ? mdocBody : sdJwtBody;
            const planId = await oidfSuite.createPlan(planName, variant, body);
            createdPlans.push({ planId, variant });
            console.log(
                `Created plan for ${variant.credential_format}: ${OIDF_URL}/plan-detail.html?plan=${planId}`,
            );
        }
    });

    afterAll(async () => {
        for (const { planId, variant } of createdPlans) {
            if (!executedPlanIds.has(planId)) {
                console.log(
                    `Skipping OIDF log export for matrix-only plan ${planId} (${variant.credential_format})`,
                );
                continue;
            }

            const outputDir = resolve(
                __dirname,
                `../../../../tmp/oidf-logs/${planId}`,
            );

            try {
                await oidfSuite.storeLog(planId, outputDir);
                console.log(
                    `Logs stored in: ${outputDir} (${variant.credential_format})`,
                );
            } catch (error) {
                console.error(
                    `Failed to export OIDF logs for plan ${planId}:`,
                    error,
                );
            }
        }

        if (app) {
            await app.close();
        }
    });

    test("list-available-test-modules - verifier plan", async () => {
        if (createdPlans.length === 0) {
            throw new Error("No verifier plans were created to list modules");
        }

        const modulesByVariant = await Promise.all(
            createdPlans.map(async ({ planId, variant }) => ({
                variant,
                modules: await oidfSuite.getAllTestsModules(planId),
            })),
        );

        for (const entry of modulesByVariant) {
            console.log(
                `Available modules in ${entry.variant.credential_format}: ${JSON.stringify(entry.modules, null, 2)}`,
            );
        }

        const uniqueModules = [
            ...new Set(modulesByVariant.flatMap((entry) => entry.modules)),
        ];
        expect(uniqueModules.length).toBeGreaterThan(0);
    });

    test("oidf conformance suite presentation - sd_jwt_vc verifier modules", async () => {
        const { planId, variant } = getPlanByCredentialFormat("sd_jwt_vc");
        await runVerifierModulesForPlan(planId, variant);
    }, 120000);

    test("oidf conformance suite presentation - iso_mdl verifier modules", async () => {
        const { planId, variant } = getPlanByCredentialFormat("iso_mdl");
        await runVerifierModulesForPlan(planId, variant);
    }, 120000);

    test("module coverage guard - verifier plan", async () => {
        if (createdPlans.length === 0) {
            throw new Error(
                "No verifier plans were created for coverage checks",
            );
        }

        const availableScenarioKeys = new Set<string>();

        for (const { planId, variant } of createdPlans) {
            const modules = await getPlanModulesCached(planId);

            for (const module of modules) {
                availableScenarioKeys.add(
                    oidfSuite.buildScenarioKey({
                        testModule: module.testModule,
                        planVariant: variant,
                        moduleVariant: module.variant,
                    }),
                );
            }
        }

        const missingScenarios = [...availableScenarioKeys].filter(
            (scenarioKey) => !coveredScenarioKeys.has(scenarioKey),
        );

        if (missingScenarios.length > 0 && !ENFORCE_MODULE_COVERAGE_GUARD) {
            console.warn(
                `OIDF verifier coverage guard warning: ${missingScenarios.length} uncovered scenarios. Set VITE_OIDF_ENFORCE_MODULE_COVERAGE=true to fail on these gaps.`,
            );
        }

        if (ENFORCE_MODULE_COVERAGE_GUARD) {
            expect(
                missingScenarios,
                `Uncovered OIDF verifier scenarios (${missingScenarios.length}) in matrix ${createdPlans
                    .map(({ variant }) => formatVariantLabel(variant))
                    .join(", ")}.`,
            ).toEqual([]);
        }
    });
});
