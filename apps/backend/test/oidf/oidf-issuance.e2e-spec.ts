import { readFileSync, writeFileSync } from "node:fs";
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
import {
    FlowType,
    OfferRequestDto,
    OfferResponse,
} from "../../src/issuer/issuance/oid4vci/dto/offer-request.dto";
import { ResponseType } from "../../src/verifier/oid4vp/dto/presentation-request.dto";
import { getDefaultSecret } from "../utils";
import {
    BACKEND_TEST_CA_PATH,
    OIDF_HTTPD_CA_PATH,
    useOidfContainers,
} from "./oidf-setup";
import { OIDFSuite, TestInstance } from "./oidf-suite";
import * as x509 from "@peculiar/x509";
import { generateCaCertPem, generateCaSignedJwk } from "./utils";

// Set up the x509 crypto provider
x509.cryptoProvider.set(globalThis.crypto);

// Setup OIDF containers for this test file
useOidfContainers();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Disable TLS verification for testing purposes

// Static list of issuer HAIP modules. Loaded synchronously at collection time
// so vitest can register one `it()` per (variant, module). The list is
// validated against the live OIDF plan in `beforeAll` and auto-rewritten if it
// drifts; the test then fails with a clear "re-run" message.
const SNAPSHOT_PATH = resolve(__dirname, "oidf-issuer-modules.snapshot.json");
const ISSUER_HAIP_MODULES: readonly string[] = (() => {
    try {
        const raw = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8"));
        return Array.isArray(raw)
            ? (raw.filter((v) => typeof v === "string") as string[])
            : [];
    } catch {
        return [];
    }
})();

const FAPI2_SECURITY_PROFILE_FINAL_PREFIX = "fapi2-security-profile-final";
const SKIPPED_ISSUER_MODULES = new Set(
    ISSUER_HAIP_MODULES.filter((moduleName) =>
        moduleName.startsWith(FAPI2_SECURITY_PROFILE_FINAL_PREFIX),
    ),
);

/**
 * E2E: OIDF conformance runner integration test for HAIP issuer test plan.
 * This test suite covers all tests from the oid4vci-1_0-issuer-haip-test-plan.
 *
 * Tests include:
 * - Metadata validation tests
 * - Happy flow tests (credential issuance)
 * - Error handling tests (invalid signatures, missing proofs, etc.)
 */
describe("OIDF - oid4vci-1_0-issuer-haip-test-plan", () => {
    const PUBLIC_DOMAIN =
        import.meta.env.VITE_DOMAIN ?? "host.testcontainers.internal:3000";
    const OIDF_URL = import.meta.env.VITE_OIDF_URL ?? "https://localhost:8443";
    const OIDF_DEMO_TOKEN = import.meta.env.VITE_OIDF_DEMO_TOKEN;
    const MODULE_FILTERS = (import.meta.env.VITE_OIDF_MODULES ?? "")
        .split(",")
        .map((value: string) => value.trim())
        .filter((value: string) => value.length > 0);
    const MODULE_PATTERN = import.meta.env.VITE_OIDF_MODULE_PATTERN
        ? new RegExp(import.meta.env.VITE_OIDF_MODULE_PATTERN)
        : undefined;

    let app: INestApplication;
    let authToken: string;

    const SD_JWT_VC_CREDENTIAL_CONFIGURATION_ID = "pid";
    const MDOC_CREDENTIAL_CONFIGURATION_ID = "pid-mdoc";

    const ISSUER_VARIANT_MATRIX = [
        {
            credential_format: "sd_jwt_vc",
            vci_authorization_code_flow_variant: "issuer_initiated",
        },
        {
            credential_format: "sd_jwt_vc",
            vci_authorization_code_flow_variant: "wallet_initiated",
        },
        {
            credential_format: "mdoc",
            vci_authorization_code_flow_variant: "issuer_initiated",
        },
        {
            credential_format: "mdoc",
            vci_authorization_code_flow_variant: "wallet_initiated",
        },
    ] as const;

    type IssuerVariant = (typeof ISSUER_VARIANT_MATRIX)[number];

    const getCredentialConfigurationIdForVariant = (
        variant: IssuerVariant,
    ): string =>
        variant.credential_format === "mdoc"
            ? MDOC_CREDENTIAL_CONFIGURATION_ID
            : SD_JWT_VC_CREDENTIAL_CONFIGURATION_ID;

    const createdPlans: Array<{
        planId: string;
        variant: IssuerVariant;
    }> = [];
    const executedPlanIds = new Set<string>();
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

    /**
     * Helper function to send a credential offer to the OIDF test runner.
     * Creates an offer via the backend API and forwards it to the test instance endpoint.
     * Uses authorization code flow as required by HAIP.
     */
    async function sendOfferToTestRunner(
        testInstance: TestInstance,
        credentialConfigurationId = SD_JWT_VC_CREDENTIAL_CONFIGURATION_ID,
    ): Promise<void> {
        // Request an issuance offer from the local backend using authorization code flow
        const offerResponse = await axiosBackendInstance
            .post<
                OfferResponse,
                axios.AxiosResponse<OfferResponse, OfferRequestDto>,
                OfferRequestDto
            >(
                "/issuer/offer",
                {
                    response_type: ResponseType.URI,
                    credentialConfigurationIds: [credentialConfigurationId],
                    flow: FlowType.AUTH_CODE,
                },
                {
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                    },
                },
            )
            .catch((err) => {
                console.log(err);
                throw new Error(err);
            });

        expect(offerResponse.data.uri).toBeDefined();

        // Extract parameters from the URI
        const uriParts = offerResponse.data.uri.split("//");
        if (uriParts.length < 2) {
            throw new Error(`Invalid URI format: ${offerResponse.data.uri}`);
        }
        const parameters = uriParts[1];

        // Get the credential offer endpoint from the test runner
        const url = await oidfSuite.getEndpoint(testInstance);
        if (!url.startsWith("https://")) {
            throw new Error(
                `Expected HTTPS credential_offer_endpoint, got: ${url}`,
            );
        }

        // Send the offer to the OIDF test runner
        await axios.default.get(`${url}${parameters}`, {
            httpsAgent: new https.Agent({
                ca: readFileSync(OIDF_HTTPD_CA_PATH),
                checkServerIdentity: () => undefined,
            }),
            proxy: false,
        });
    }

    beforeAll(async () => {
        const planName = "oid4vci-1_0-issuer-haip-test-plan";

        // Generate CA-signed certificates on demand for valid timestamps
        const clientSigningJwk = await generateCaSignedJwk({
            use: "sig",
            alg: "ES256",
            cn: "OIDF Test Client",
        });

        // Generate CA-signed certificate for client attester
        const attesterJwk = await generateCaSignedJwk({
            use: "sig",
            alg: "ES256",
            cn: "OIDF Client Attester",
        });
        // Override kid to "key1" for attester
        attesterJwk.kid = "key1";

        // Generate CA-signed certificate for key attestation
        const keyAttestationJwk = await generateCaSignedJwk({
            use: "sig",
            alg: "ES256",
            cn: "OIDF Key Attestation",
        });

        // Generate trust anchor PEMs from the issuer's key chains
        // These are the CA certificates that signed the issuer's credential and status list
        const configFolder = resolve(__dirname + "/../fixtures");
        const attestationKeyChain = JSON.parse(
            readFileSync(
                join(configFolder, "haip/key-chains/attestation.json"),
                "utf-8",
            ),
        );
        const statusListKeyChain = JSON.parse(
            readFileSync(
                join(configFolder, "haip/key-chains/status-list.json"),
                "utf-8",
            ),
        );

        // Generate CA certificate PEMs for trust anchors
        const trustAnchorPem = await generateCaCertPem(attestationKeyChain.key);
        const statusListTrustAnchorPem = await generateCaCertPem(
            statusListKeyChain.key,
        );

        for (const [_index, variant] of ISSUER_VARIANT_MATRIX.entries()) {
            const body = {
                //alias: `eudiplo-${index}`,
                description: `test plan ${variant.credential_format}/${variant.vci_authorization_code_flow_variant}`,
                publish: "everything",
                client: {
                    client_id: "localhost",
                },
                client2: {
                    client_id: "localhost2",
                },
                server: {
                    discoveryIssuer: `https://${PUBLIC_DOMAIN}/issuers/haip`,
                },
                credential: {
                    signing_jwk: clientSigningJwk,
                    trust_anchor_pem: trustAnchorPem,
                    status_list_trust_anchor_pem: statusListTrustAnchorPem,
                },
                vci: {
                    credential_issuer_url: `https://${PUBLIC_DOMAIN}/issuers/haip`,
                    credential_configuration_id:
                        getCredentialConfigurationIdForVariant(variant),
                    client_attester_keys_jwks: {
                        keys: [attesterJwk],
                    },
                    client_attestation_issuer:
                        "https://client-attester.example.org/",
                    key_attestation_jwks: {
                        keys: [keyAttestationJwk],
                    },
                },
                browser: [
                    {
                        comment:
                            "expect an immediate redirect back to the conformance suite",
                        match: "https://*/authorize*",
                        tasks: [
                            {
                                task: "Verify Complete",
                                match: "*/test/*/callback*",
                                comment:
                                    "declaring both this and the next task as optional means this configuration works regardless of whether a url is returned in the direct post response",
                                optional: true,
                                commands: [
                                    ["wait", "id", "submission_complete", 10],
                                ],
                            },
                            {
                                task: "Verify Complete",
                                optional: true,
                                match: "https://*/authorize*",
                            },
                        ],
                    },
                ],
            };

            try {
                const planId = await oidfSuite.createPlan(
                    planName,
                    variant,
                    body,
                );
                createdPlans.push({
                    planId,
                    variant,
                });
            } catch (error: any) {
                const reason = String(
                    error?.response?.data?.error_description ??
                        error?.response?.data?.error ??
                        error?.message ??
                        error,
                );
                throw new Error(
                    `Failed to create required issuer variant ${variant.credential_format}/${variant.vci_authorization_code_flow_variant}: ${reason}`,
                );
            }
        }

        if (createdPlans.length !== ISSUER_VARIANT_MATRIX.length) {
            throw new Error(
                `Full issuer matrix is required. Created ${createdPlans.length}/${ISSUER_VARIANT_MATRIX.length} base plans.`,
            );
        }

        // Validate the static module snapshot against OIDF reality. If it
        // drifted (or was missing), rewrite the snapshot file and fail with a
        // clear "re-run" message so vitest picks up the new entries on the
        // next run.
        const livePlanModules = await oidfSuite.getPlanModules(
            createdPlans[0].planId,
        );
        const liveModuleNames = livePlanModules
            .map((m) => m.testModule)
            .sort((a, b) => a.localeCompare(b));
        const snapshotSorted = [...ISSUER_HAIP_MODULES].sort((a, b) =>
            a.localeCompare(b),
        );
        const snapshotMatches =
            liveModuleNames.length === snapshotSorted.length &&
            liveModuleNames.every((name, idx) => name === snapshotSorted[idx]);
        if (!snapshotMatches) {
            writeFileSync(
                SNAPSHOT_PATH,
                `${JSON.stringify(liveModuleNames, null, 2)}\n`,
            );
            const missing = liveModuleNames.filter(
                (name) => !ISSUER_HAIP_MODULES.includes(name),
            );
            const extra = ISSUER_HAIP_MODULES.filter(
                (name) => !liveModuleNames.includes(name),
            );
            throw new Error(
                `Issuer module snapshot drifted and was rewritten at ${SNAPSHOT_PATH}. ` +
                    `Added: [${missing.join(", ")}]. Removed: [${extra.join(", ")}]. ` +
                    `Please re-run the test so vitest picks up the new module list.`,
            );
        }

        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        // Enable HTTPS with self-signed certificate
        // FAPI 2.0 requires TLS 1.3 ciphers only (FAPI2-SP-FINAL-5.2.2-1)
        // Setting TLS 1.3 only - clients attempting TLS 1.2 will get protocol_version alert
        // which is correct behavior for a FAPI 2.0 compliant server
        const httpsOptions = {
            key: readFileSync(resolve(__dirname, "../key.pem")),
            cert: readFileSync(resolve(__dirname, "../cert.pem")),
            minVersion: "TLSv1.3" as const,
            maxVersion: "TLSv1.3" as const,
        };

        app = moduleFixture.createNestApplication<NestExpressApplication>({
            httpsOptions,
        });

        // Use Pino logger for all NestJS logging (same as main.ts)
        app.useLogger(app.get(Logger));
        app.useGlobalPipes(new ValidationPipe());

        const configService = app.get(ConfigService);
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

        // Acquire JWT token using client credentials over HTTPS.
        const tokenResponse = await axiosBackendInstance
            .post<{
                access_token: string;
            }>("/api/oauth2/token", {
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "client_credentials",
            })
            .catch((err) => {
                console.log(err);
                throw new Error(err);
            });

        authToken = tokenResponse.data.access_token;
        expect(authToken).toBeDefined();
    });

    afterAll(async () => {
        for (const { planId, variant } of createdPlans) {
            if (!executedPlanIds.has(planId)) {
                console.log(
                    `Skipping OIDF log export for matrix-only plan ${planId} (${variant.credential_format}/${variant.vci_authorization_code_flow_variant})`,
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
                    `Test log extracted to: ${outputDir} (${variant.credential_format}/${variant.vci_authorization_code_flow_variant})`,
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

    // ============================================================================
    // MODULE EXECUTION MATRIX
    // Execute issuer modules through a single loop so coverage and report export
    // stay consistent as module/variant combinations evolve.
    // ============================================================================

    type IssuerModuleCase = {
        moduleName: string;
        expectedResults: ReadonlyArray<"PASSED" | "WARNING" | "FAILED">;
        triggerOffer?: boolean;
        credentialConfigurationIdForVariant?: (
            variant: IssuerVariant,
        ) => string;
    };

    const DEFAULT_ISSUER_MODULE_CASE: Omit<IssuerModuleCase, "moduleName"> = {
        expectedResults: ["PASSED"],
        triggerOffer: true,
    };

    const ISSUER_MODULE_CASE_OVERRIDES: Record<
        string,
        Partial<IssuerModuleCase>
    > = {
        "oid4vci-1_0-issuer-metadata-test": {
            expectedResults: ["WARNING"],
            triggerOffer: false,
        },
        "oid4vci-1_0-issuer-metadata-test-signed": {
            expectedResults: ["PASSED", "WARNING"],
            triggerOffer: false,
        },
        "oid4vci-1_0-issuer-happy-flow-additional-requests": {
            expectedResults: ["FAILED"],
        },
        "oid4vci-1_0-issuer-happy-flow-multiple-clients": {
            expectedResults: ["FAILED"],
        },
    };

    const buildIssuerModuleCase = (moduleName: string): IssuerModuleCase => {
        const normalizedName = moduleName.toLowerCase();

        const baseCase: IssuerModuleCase = {
            moduleName,
            ...DEFAULT_ISSUER_MODULE_CASE,
        };

        if (normalizedName.includes("metadata-test-signed")) {
            baseCase.expectedResults = ["PASSED", "WARNING"];
            baseCase.triggerOffer = false;
        } else if (normalizedName.includes("metadata")) {
            baseCase.expectedResults = ["WARNING"];
            baseCase.triggerOffer = false;
        } else if (normalizedName.startsWith("fapi2-security-profile")) {
            baseCase.triggerOffer = false;
            baseCase.expectedResults = ["SKIPPED"];
        } else if (
            normalizedName.includes("fail") ||
            normalizedName.includes("invalid")
        ) {
            baseCase.expectedResults = ["PASSED"];
        }
        return {
            ...baseCase,
            ...ISSUER_MODULE_CASE_OVERRIDES[moduleName],
        };
    };

    /**
     * Per-module outcome captured by each variant's `beforeAll`. Looked up
     * by the per-module `it()` blocks for assertions, so vitest reports one
     * pass/fail entry per (variant, module) combination.
     */
    type ModuleOutcome =
        | { kind: "ok"; result: string; status: string; durationMs: number }
        | { kind: "error"; error: Error; durationMs: number };

    const buildSkipReason = (moduleName: string): string | undefined => {
        if (SKIPPED_ISSUER_MODULES.has(moduleName)) {
            return "fapi2 security profile test";
        }
        if (
            MODULE_FILTERS.length > 0 &&
            !MODULE_FILTERS.some((filterValue: string) =>
                moduleName.includes(filterValue),
            )
        ) {
            return "filtered out by VITE_OIDF_MODULES";
        }
        if (MODULE_PATTERN && !MODULE_PATTERN.test(moduleName)) {
            return "filtered out by VITE_OIDF_MODULE_PATTERN";
        }
        return undefined;
    };

    const runModuleForVariant = async (
        planId: string,
        variant: IssuerVariant,
        moduleName: string,
        moduleCase: IssuerModuleCase,
    ): Promise<ModuleOutcome> => {
        const variantLabel = `${variant.credential_format}/${variant.vci_authorization_code_flow_variant}`;
        const startedAt = Date.now();
        let testInstance: TestInstance | undefined;
        try {
            testInstance = await oidfSuite.startTest(planId, moduleName);
            console.log(
                `Test details (${variantLabel}/${moduleName}): ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
            );

            const shouldTriggerOffer =
                moduleCase.triggerOffer !== false &&
                variant.vci_authorization_code_flow_variant ===
                    "issuer_initiated";

            if (shouldTriggerOffer) {
                await sendOfferToTestRunner(
                    testInstance,
                    moduleCase.credentialConfigurationIdForVariant?.(variant) ??
                        getCredentialConfigurationIdForVariant(variant),
                );
            }

            const logResult = await oidfSuite.waitForFinished(testInstance.id);
            const durationMs = Date.now() - startedAt;
            console.log(
                `Module finished (${variantLabel}/${moduleName}) in ${durationMs}ms → result=${logResult.result} status=${logResult.status}`,
            );
            return {
                kind: "ok",
                result: logResult.result,
                status: logResult.status,
                durationMs,
            };
        } catch (error) {
            const durationMs = Date.now() - startedAt;
            const wrapped =
                error instanceof Error ? error : new Error(String(error));

            if (testInstance?.id) {
                const failedOutputDir = resolve(
                    __dirname,
                    `../../../../tmp/oidf-logs/failed/${testInstance.id}`,
                );
                try {
                    const failedLogPath = await oidfSuite.storeTestLog(
                        testInstance.id,
                        failedOutputDir,
                    );
                    console.error(
                        `Failed test log extracted to: ${failedLogPath} (${variantLabel}/${moduleName})`,
                    );
                } catch (exportError) {
                    console.error(
                        `Failed to export per-test OIDF log for ${moduleName} (${testInstance.id}):`,
                        exportError,
                    );
                }
            }

            console.error(
                `Module errored (${variantLabel}/${moduleName}) after ${durationMs}ms: ${wrapped.message}`,
            );
            return { kind: "error", error: wrapped, durationMs };
        }
    };

    // Per-variant describes register one `it()` per module so vitest reports
    // a separate pass/fail line for every (variant, module) combination.
    // Each variant's `beforeAll` runs its modules sequentially against its
    // dedicated plan; the four variant chains run in parallel via
    // `describe.concurrent`.
    for (const variant of ISSUER_VARIANT_MATRIX) {
        const variantLabel = `${variant.credential_format} / ${variant.vci_authorization_code_flow_variant}`;

        describe.concurrent(variantLabel, () => {
            const outcomes = new Map<string, ModuleOutcome>();
            let variantBootstrapError: Error | undefined;

            beforeAll(async () => {
                const planEntry = createdPlans.find(
                    (entry) => entry.variant === variant,
                );
                if (!planEntry) {
                    variantBootstrapError = new Error(
                        `No plan was created for variant ${variantLabel}`,
                    );
                    return;
                }

                for (const moduleName of ISSUER_HAIP_MODULES) {
                    const moduleCase = buildIssuerModuleCase(moduleName);
                    if (buildSkipReason(moduleName)) {
                        continue;
                    }
                    outcomes.set(
                        moduleName,
                        await runModuleForVariant(
                            planEntry.planId,
                            variant,
                            moduleName,
                            moduleCase,
                        ),
                    );
                }
            }, 600_000);

            for (const moduleName of ISSUER_HAIP_MODULES) {
                const moduleCase = buildIssuerModuleCase(moduleName);
                const skipReason = buildSkipReason(moduleName);
                if (skipReason) {
                    test.skip(`${moduleName} (${skipReason})`, () => {});
                    continue;
                }

                test(moduleName, () => {
                    if (variantBootstrapError) {
                        throw variantBootstrapError;
                    }
                    const outcome = outcomes.get(moduleName);
                    if (!outcome) {
                        throw new Error(
                            `Module ${moduleName} did not run for variant ${variantLabel}`,
                        );
                    }
                    if (outcome.kind === "error") {
                        throw outcome.error;
                    }
                    expect(
                        moduleCase.expectedResults,
                        `result=${outcome.result} status=${outcome.status} (expected one of ${moduleCase.expectedResults.join(", ")})`,
                    ).toContain(outcome.result);
                });
            }
        });
    }
});
