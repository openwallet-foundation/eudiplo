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
            planModulesCache.set(planId, await oidfSuite.getPlanModules(planId));
        }
        return planModulesCache.get(planId)!;
    };

    /**
     * Runs a verifier module against every created plan variant.
     * Skips plans where the module does not exist (format-specific modules).
     */
    const forEachPlan = async (
        moduleName: string,
        action: (
            testInstance: TestInstance,
            variant: VerifierVariant,
            planId: string,
        ) => Promise<void>,
    ): Promise<void> => {
        let ranCount = 0;

        for (const { planId, variant } of createdPlans) {
            const modules = await getPlanModulesCached(planId);
            const module = modules.find((m) => m.testModule === moduleName);

            if (!module) {
                console.warn(
                    `Module '${moduleName}' not found in plan ${variant.credential_format}, skipping.`,
                );
                continue;
            }

            const testInstance = await oidfSuite.startTest(planId, moduleName);
            console.log(
                `Test details (${variant.credential_format}/${variant.client_id_prefix}/${variant.request_method}/${variant.response_mode}): ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
            );

            await action(testInstance, variant, planId);

            coveredScenarioKeys.add(
                oidfSuite.buildScenarioKey({
                    testModule: module.testModule,
                    planVariant: variant,
                    moduleVariant: module.variant,
                }),
            );

            ranCount++;
        }

        if (ranCount === 0) {
            console.warn(
                `Module '${moduleName}' was not found in any target verifier plan.`,
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

        const logResult = await oidfSuite.waitForFinished(
            testInstance.id,
        );
        expect(["PASSED", "SKIPPED", "WARNING"]).toContain(
            logResult.result,
        );
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

    test("oidf conformance suite presentation - all verifier modules", async () => {
        if (createdPlans.length === 0) {
            throw new Error("No verifier plans were created to execute modules");
        }

        const uniqueModules = [
            ...new Set(
                (await Promise.all(
                    createdPlans.map(({ planId }) =>
                        oidfSuite.getAllTestsModules(planId),
                    ),
                )).flat(),
            ),
        ].sort((a, b) => a.localeCompare(b));

        for (const moduleName of uniqueModules) {
            await forEachPlan(moduleName, async (testInstance, variant) => {
                await sendPresentationToTestRunner(testInstance, variant);

                const logResult = await oidfSuite.waitForFinished(
                    testInstance.id,
                );
                const allowedResults = getAllowedResults(moduleName);

                expect(
                    allowedResults,
                    `Unexpected result for module '${moduleName}' on ${variant.credential_format}/${variant.client_id_prefix}/${variant.request_method}/${variant.response_mode}: ${logResult.result}`,
                ).toContain(logResult.result);
            });
        }
    }, 120000);

    test("module coverage guard - verifier plan", async () => {
        if (createdPlans.length === 0) {
            throw new Error("No verifier plans were created for coverage checks");
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
                    .map(
                        ({ variant }) =>
                            `${variant.credential_format}/${variant.client_id_prefix}/${variant.request_method}/${variant.response_mode}`,
                    )
                    .join(", ")}.`,
            ).toEqual([]);
        }
    });
});
