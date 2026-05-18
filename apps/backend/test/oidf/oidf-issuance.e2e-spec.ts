import { readFileSync } from "node:fs";
import https from "node:https";
import { join, resolve } from "node:path";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestExpressApplication } from "@nestjs/platform-express";
import { Test, TestingModule } from "@nestjs/testing";
import * as x509 from "@peculiar/x509";
import { X509CertificateGenerator } from "@peculiar/x509";
import * as axios from "axios";
import { exportJWK, generateKeyPair } from "jose";
import { Logger } from "nestjs-pino";
import { beforeAll, describe, expect, test } from "vitest";
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

// Set up the x509 crypto provider
x509.cryptoProvider.set(globalThis.crypto);

/**
 * Generate a self-signed CA certificate PEM from a JWK.
 * This is used to create trust anchors for the OIDF test runner.
 */
async function generateCaCertPem(jwk: {
    d: string;
    x: string;
    y: string;
    crv?: string;
}): Promise<string> {
    const signingAlg = { name: "ECDSA", hash: "SHA-256" };

    // Import the private key
    const privateKey = await globalThis.crypto.subtle.importKey(
        "jwk",
        {
            kty: "EC",
            crv: jwk.crv ?? "P-256",
            d: jwk.d,
            x: jwk.x,
            y: jwk.y,
        },
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign"],
    );

    // Import the public key
    const publicKey = await globalThis.crypto.subtle.importKey(
        "jwk",
        {
            kty: "EC",
            crv: jwk.crv ?? "P-256",
            x: jwk.x,
            y: jwk.y,
        },
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["verify"],
    );

    // Generate self-signed CA certificate
    const caCert = await X509CertificateGenerator.createSelfSigned({
        serialNumber: "01",
        name: "CN=EUDIPLO Test CA",
        notBefore: new Date(),
        notAfter: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 years
        signingAlgorithm: signingAlg,
        keys: { privateKey, publicKey },
        extensions: [
            new x509.BasicConstraintsExtension(true, undefined, true),
            new x509.KeyUsagesExtension(
                x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign,
                true,
            ),
        ],
    });

    return caCert.toString("pem");
}

/**
 * Generate a CA-signed certificate chain for OIDF testing.
 * Returns a JWK with proper x5c containing [leaf, CA] certificates.
 * The leaf certificate is NOT self-signed (issuer = CA, subject = leaf).
 */
async function generateCaSignedJwk(options: {
    use: "sig" | "enc";
    alg: "ES256" | "ECDH-ES";
    cn: string;
}): Promise<{
    kty: string;
    d: string;
    use: string;
    crv: string;
    kid: string;
    x: string;
    y: string;
    alg: string;
    x5c: string[];
}> {
    const signingAlg = { name: "ECDSA", hash: "SHA-256" };

    // Generate CA key pair
    const caKeyPair = await globalThis.crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
    );

    // Generate CA certificate (self-signed root)
    const caCert = await X509CertificateGenerator.createSelfSigned({
        serialNumber: "01",
        name: "CN=OIDF Test CA",
        notBefore: new Date(),
        notAfter: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 years
        signingAlgorithm: signingAlg,
        keys: caKeyPair,
        extensions: [
            new x509.BasicConstraintsExtension(true, undefined, true),
            new x509.KeyUsagesExtension(
                x509.KeyUsageFlags.keyCertSign | x509.KeyUsageFlags.cRLSign,
                true,
            ),
        ],
    });

    // Generate leaf key pair
    const leafKeyPair = await globalThis.crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign", "verify"],
    );

    // Generate leaf certificate signed by CA
    const leafCert = await X509CertificateGenerator.create({
        serialNumber: "02",
        subject: `CN=${options.cn}`,
        issuer: caCert.subject,
        notBefore: new Date(),
        notAfter: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        signingAlgorithm: signingAlg,
        publicKey: leafKeyPair.publicKey,
        signingKey: caKeyPair.privateKey,
        extensions: [
            new x509.BasicConstraintsExtension(false, undefined, true),
            new x509.KeyUsagesExtension(
                x509.KeyUsageFlags.digitalSignature,
                true,
            ),
            // Add SAN for localhost and test domains
            new x509.SubjectAlternativeNameExtension([
                { type: "dns", value: "localhost" },
                { type: "dns", value: "host.testcontainers.internal" },
            ]),
        ],
    });

    // Export the leaf private key as JWK
    const leafJwk = await exportJWK(leafKeyPair.privateKey);

    // Generate kid from public key
    const leafPublicJwk = await exportJWK(leafKeyPair.publicKey);
    const kidData = new TextEncoder().encode(
        JSON.stringify({ x: leafPublicJwk.x, y: leafPublicJwk.y }),
    );
    const kidHash = await globalThis.crypto.subtle.digest("SHA-256", kidData);
    const kid = Buffer.from(kidHash).toString("base64url").substring(0, 43);

    return {
        kty: "EC",
        d: leafJwk.d as string,
        use: options.use,
        crv: "P-256",
        kid,
        x: leafJwk.x as string,
        y: leafJwk.y as string,
        alg: options.alg,
        x5c: [leafCert.toString("base64"), caCert.toString("base64")],
    };
}

// Setup OIDF containers for this test file
useOidfContainers();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Disable TLS verification for testing purposes

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

    let app: INestApplication;
    let PLAN_ID: string;
    let PLAN_ID_KEY_ATTESTATION: string;
    let authToken: string;

    const DEFAULT_CREDENTIAL_CONFIGURATION_ID = "pid";
    const KEY_ATTESTATION_CREDENTIAL_CONFIGURATION_ID = "pid-key";

    const RUN_FULL_MATRIX = import.meta.env.VITE_OIDF_FULL_MATRIX === "true";
    const ENFORCE_MODULE_COVERAGE_GUARD =
        import.meta.env.VITE_OIDF_ENFORCE_MODULE_COVERAGE === "true";

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
            credential_format: "mso_mdoc",
            vci_authorization_code_flow_variant: "issuer_initiated",
        },
        {
            credential_format: "mso_mdoc",
            vci_authorization_code_flow_variant: "wallet_initiated",
        },
    ] as const;

    // Fast mode keeps runtime lower while still checking both format and flow.
    const ENFORCED_ISSUER_VARIANTS = RUN_FULL_MATRIX
        ? [...ISSUER_VARIANT_MATRIX]
        : [ISSUER_VARIANT_MATRIX[0], ISSUER_VARIANT_MATRIX[3]];

    type IssuerVariant = (typeof ISSUER_VARIANT_MATRIX)[number];

    const createdPlans: Array<{
        planId: string;
        variant: IssuerVariant;
    }> = [];
    const unavailableVariantCombinations: Array<{
        variant: IssuerVariant;
        reason: string;
    }> = [];

    const axiosBackendInstance = axios.default.create({
        baseURL: "https://localhost:3000",
        httpsAgent: new https.Agent({
            ca: readFileSync(BACKEND_TEST_CA_PATH),
            checkServerIdentity: () => undefined,
        }),
    });

    const oidfSuite = new OIDFSuite(OIDF_URL, OIDF_DEMO_TOKEN);

    // Keep this list in sync with executed tests below.
    const COVERED_ISSUER_MODULES = [
        "oid4vci-1_0-issuer-metadata-test",
        "oid4vci-1_0-issuer-metadata-test-signed",
        "oid4vci-1_0-issuer-happy-flow",
        "oid4vci-1_0-issuer-happy-flow-skip-notification",
        "oid4vci-1_0-issuer-fail-invalid-nonce",
        "oid4vci-1_0-issuer-fail-invalid-jwt-proof-signature",
        "oid4vci-1_0-issuer-fail-invalid-key-attestation-signature",
        "oid4vci-1_0-issuer-fail-invalid-client-attestation-signature",
        "oid4vci-1_0-issuer-fail-invalid-client-attestation-pop-signature",
        "oid4vci-1_0-issuer-fail-mismatched-client-attestation-pop-key",
        "oid4vci-1_0-issuer-fail-missing-proof",
        "oid4vci-1_0-issuer-fail-unknown-credential-configuration",
        "oid4vci-1_0-issuer-fail-unknown-credential-identifier",
        "oid4vci-1_0-issuer-fail-on-access-token-in-query",
        "oid4vci-1_0-issuer-fail-unsupported-encryption-algorithm",
    ] as const;

    // Modules intentionally not executed until known issues are resolved.
    const INTENTIONALLY_SKIPPED_ISSUER_MODULES = [
        "oid4vci-1_0-issuer-happy-flow-additional-requests",
        "oid4vci-1_0-issuer-happy-flow-multiple-clients",
    ] as const;
    const INTENTIONALLY_SKIPPED_ISSUER_MODULE_SET = new Set<string>(
        INTENTIONALLY_SKIPPED_ISSUER_MODULES,
    );

    /**
     * Helper function to send a credential offer to the OIDF test runner.
     * Creates an offer via the backend API and forwards it to the test instance endpoint.
     * Uses authorization code flow as required by HAIP.
     */
    async function sendOfferToTestRunner(
        testInstance: TestInstance,
        credentialConfigurationId = DEFAULT_CREDENTIAL_CONFIGURATION_ID,
    ): Promise<void> {
        // Request an issuance offer from the local backend using authorization code flow
        const offerResponse = await axiosBackendInstance.post<
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
        );

        expect(offerResponse.data.uri).toBeDefined();

        // Extract parameters from the URI
        const uriParts = offerResponse.data.uri.split("//");
        if (uriParts.length < 2) {
            throw new Error(`Invalid URI format: ${offerResponse.data.uri}`);
        }
        const parameters = uriParts[1];

        // Get the credential offer endpoint from the test runner
        const url = await oidfSuite.getEndpoint(testInstance);

        // Send the offer to the OIDF test runner
        await axios.default.get(`${url}${parameters}`, {
            httpsAgent: new https.Agent({
                ca: readFileSync(OIDF_HTTPD_CA_PATH),
                checkServerIdentity: () => undefined,
            }),
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

        // Generate encryption key (no certificate needed for ECDH-ES)
        const encKeyPair = await generateKeyPair("ECDH-ES", {
            crv: "P-256",
            extractable: true,
        });
        const encPubJwk = await exportJWK(encKeyPair.publicKey);
        const encKidData = new TextEncoder().encode(
            JSON.stringify({ x: encPubJwk.x, y: encPubJwk.y }),
        );
        const _encKidHash = await globalThis.crypto.subtle.digest(
            "SHA-256",
            encKidData,
        );

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

        for (const [index, variant] of ENFORCED_ISSUER_VARIANTS.entries()) {
            const body = {
                alias: `eudiplo-${index}`,
                description: `test plan ${variant.credential_format}/${variant.vci_authorization_code_flow_variant}`,
                publish: "everything",
                client: {
                    client_id: "localhost",
                },
                // neded for outcomment second client test
                /* client2: {
                    client_id: "localhost2",
                }, */
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
                        DEFAULT_CREDENTIAL_CONFIGURATION_ID,
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
                unavailableVariantCombinations.push({
                    variant,
                    reason: String(
                        error?.response?.data?.error_description ??
                            error?.response?.data?.error ??
                            error?.message ??
                            error,
                    ),
                });
                console.warn(
                    `Skipping unsupported issuer variant ${variant.credential_format}/${variant.vci_authorization_code_flow_variant}`,
                );
            }
        }

        if (createdPlans.length === 0) {
            throw new Error(
                `No issuer plans could be created for variants: ${ENFORCED_ISSUER_VARIANTS.map((variant) => `${variant.credential_format}/${variant.vci_authorization_code_flow_variant}`).join(", ")}`,
            );
        }

        PLAN_ID = createdPlans[0].planId;

        const keyAttestationPlanBody = {
            alias: "eudiplo-key-attestation",
            description: "test plan sd_jwt_vc/issuer_initiated key-attestation",
            publish: "everything",
            client: {
                client_id: "localhost",
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
                    KEY_ATTESTATION_CREDENTIAL_CONFIGURATION_ID,
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

        PLAN_ID_KEY_ATTESTATION = await oidfSuite.createPlan(
            planName,
            createdPlans[0].variant,
            keyAttestationPlanBody,
        );
        createdPlans.push({
            planId: PLAN_ID_KEY_ATTESTATION,
            variant: createdPlans[0].variant,
        });

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
    });

    afterAll(async () => {
        for (const { planId, variant } of createdPlans) {
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
    // DEBUG: List available test modules
    // ============================================================================

    test("list-available-test-modules", async () => {
        const modules = await oidfSuite.getAllTestsModules(PLAN_ID);
        console.log(
            "Available test modules in plan:",
            JSON.stringify(modules, null, 2),
        );
        expect(modules).toBeDefined();
        expect(modules.length).toBeGreaterThan(0);
    });

    test("module coverage guard - issuer HAIP plan", async () => {
        if (createdPlans.length === 0) {
            throw new Error("No issuer plans were created for coverage checks");
        }

        const availableScenarioKeys = new Set<string>();
        const skippedScenarioKeys = new Set<string>();
        const primaryPlanModules = await oidfSuite.getPlanModules(PLAN_ID);

        for (const { planId, variant } of createdPlans) {
            const modules = await oidfSuite.getPlanModules(planId);

            for (const module of modules) {
                const scenarioKey = oidfSuite.buildScenarioKey({
                    testModule: module.testModule,
                    planVariant: variant,
                    moduleVariant: module.variant,
                });

                availableScenarioKeys.add(scenarioKey);

                if (
                    INTENTIONALLY_SKIPPED_ISSUER_MODULE_SET.has(
                        module.testModule,
                    )
                ) {
                    skippedScenarioKeys.add(scenarioKey);
                }
            }
        }

        const coveredScenarioKeys = new Set<string>();
        for (const coveredModuleName of COVERED_ISSUER_MODULES) {
            const module = primaryPlanModules.find(
                (planModule) => planModule.testModule === coveredModuleName,
            );

            if (!module) {
                continue;
            }

            coveredScenarioKeys.add(
                oidfSuite.buildScenarioKey({
                    testModule: module.testModule,
                    planVariant: createdPlans[0].variant,
                    moduleVariant: module.variant,
                }),
            );
        }

        const missingScenarios = [...availableScenarioKeys].filter(
            (scenarioKey) =>
                !coveredScenarioKeys.has(scenarioKey) &&
                !skippedScenarioKeys.has(scenarioKey),
        );

        const staleConfiguredModules = [
            ...COVERED_ISSUER_MODULES,
            ...INTENTIONALLY_SKIPPED_ISSUER_MODULES,
        ].filter(
            (moduleName) =>
                !primaryPlanModules.some(
                    (planModule) => planModule.testModule === moduleName,
                ),
        );

        expect(
            staleConfiguredModules,
            `Configured issuer modules no longer exist in primary plan: ${staleConfiguredModules.join(", ")}.`,
        ).toEqual([]);

        if (missingScenarios.length > 0 && !ENFORCE_MODULE_COVERAGE_GUARD) {
            console.warn(
                `OIDF issuer coverage guard warning: ${missingScenarios.length} uncovered scenarios. Set VITE_OIDF_ENFORCE_MODULE_COVERAGE=true to fail on these gaps.`,
            );
        }

        if (ENFORCE_MODULE_COVERAGE_GUARD) {
            expect(
                missingScenarios,
                `Uncovered OIDF issuer scenarios (${missingScenarios.length}) in matrix ${createdPlans.map(({ variant }) => `${variant.credential_format}/${variant.vci_authorization_code_flow_variant}`).join(", ")}.${unavailableVariantCombinations.length > 0 ? ` Skipped unsupported variants: ${unavailableVariantCombinations.map(({ variant }) => `${variant.credential_format}/${variant.vci_authorization_code_flow_variant}`).join(", ")}.` : ""}`,
            ).toEqual([]);
        }
    });

    // ============================================================================
    // METADATA TESTS
    // These tests validate the metadata exposed by the credential issuer
    // ============================================================================

    test("oid4vci-1_0-issuer-metadata-test", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID,
            "oid4vci-1_0-issuer-metadata-test",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        // Warning is fine because unknown entries are in the metadata (iae and status list information)
        expect(logResult.result).toBe("WARNING");
    });

    test("oid4vci-1_0-issuer-metadata-test-signed", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID,
            "oid4vci-1_0-issuer-metadata-test-signed",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        // Test is skipped if signed metadata is not supported
        expect(["PASSED", "SKIPPED", "WARNING"]).toContain(logResult.result);
    });

    // ============================================================================
    // HAPPY FLOW TESTS
    // These tests validate the standard credential issuance flow
    // ============================================================================

    test("oid4vci-1_0-issuer-happy-flow", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID,
            "oid4vci-1_0-issuer-happy-flow",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        await sendOfferToTestRunner(testInstance);

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        expect(logResult.result).toBe("PASSED");
    }, 10000);

    //TODO: fix test with TLS connection (not a basic problem of oid4vc)
    /* test("oid4vci-1_0-issuer-happy-flow-additional-requests", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID,
            "oid4vci-1_0-issuer-happy-flow-additional-requests",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        await sendOfferToTestRunner(testInstance);

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        expect(logResult.result).toBe("PASSED");
    }, 15000); */

    /*     test("oid4vci-1_0-issuer-happy-flow-multiple-clients", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID,
            "oid4vci-1_0-issuer-happy-flow-multiple-clients",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        await sendOfferToTestRunner(testInstance);

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        expect(logResult.result).toBe("PASSED");
    }, 15000); */

    test("oid4vci-1_0-issuer-happy-flow-skip-notification", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID,
            "oid4vci-1_0-issuer-happy-flow-skip-notification",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        await sendOfferToTestRunner(testInstance);

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        expect(logResult.result).toBe("PASSED");
    }, 10000);

    // ============================================================================
    // FAIL TESTS - Invalid Signatures and Proofs
    // These tests verify proper error handling for invalid inputs
    // ============================================================================

    test("oid4vci-1_0-issuer-fail-invalid-nonce", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID,
            "oid4vci-1_0-issuer-fail-invalid-nonce",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        await sendOfferToTestRunner(testInstance);

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        // Test may be skipped if credential configuration does not require proof
        expect(["PASSED", "SKIPPED"]).toContain(logResult.result);
    }, 10000);

    test("oid4vci-1_0-issuer-fail-invalid-jwt-proof-signature", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID,
            "oid4vci-1_0-issuer-fail-invalid-jwt-proof-signature",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        await sendOfferToTestRunner(testInstance);

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        // Test may be skipped for attestation proof type
        expect(["PASSED", "SKIPPED"]).toContain(logResult.result);
    }, 10000);

    test("oid4vci-1_0-issuer-fail-invalid-key-attestation-signature", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID_KEY_ATTESTATION,
            "oid4vci-1_0-issuer-fail-invalid-key-attestation-signature",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        await sendOfferToTestRunner(
            testInstance,
            KEY_ATTESTATION_CREDENTIAL_CONFIGURATION_ID,
        );

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        // Test may be skipped if key attestation is not required
        expect(["PASSED", "SKIPPED"]).toContain(logResult.result);
    }, 10000);

    test("oid4vci-1_0-issuer-fail-invalid-client-attestation-signature", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID,
            "oid4vci-1_0-issuer-fail-invalid-client-attestation-signature",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        await sendOfferToTestRunner(testInstance);

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        expect(logResult.result).toBe("PASSED");
    }, 10000);

    test("oid4vci-1_0-issuer-fail-invalid-client-attestation-pop-signature", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID,
            "oid4vci-1_0-issuer-fail-invalid-client-attestation-pop-signature",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        await sendOfferToTestRunner(testInstance);

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        // Test may be skipped for non-client_attestation auth methods
        expect(["PASSED", "SKIPPED"]).toContain(logResult.result);
    }, 10000);

    test("oid4vci-1_0-issuer-fail-mismatched-client-attestation-pop-key", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID,
            "oid4vci-1_0-issuer-fail-mismatched-client-attestation-pop-key",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        await sendOfferToTestRunner(testInstance);

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        // Test may be skipped for non-client_attestation auth methods
        expect(["PASSED", "SKIPPED"]).toContain(logResult.result);
    }, 10000);

    test("oid4vci-1_0-issuer-fail-missing-proof", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID,
            "oid4vci-1_0-issuer-fail-missing-proof",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        await sendOfferToTestRunner(testInstance);

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        // Test may be skipped if credential configuration does not require proof
        expect(["PASSED", "SKIPPED"]).toContain(logResult.result);
    }, 10000);

    // ============================================================================
    // FAIL TESTS - Invalid Credential Configuration/Identifier
    // ============================================================================

    test("oid4vci-1_0-issuer-fail-unknown-credential-configuration", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID,
            "oid4vci-1_0-issuer-fail-unknown-credential-configuration",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        await sendOfferToTestRunner(testInstance);

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        expect(logResult.result).toBe("PASSED");
    }, 10000);

    test("oid4vci-1_0-issuer-fail-unknown-credential-identifier", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID,
            "oid4vci-1_0-issuer-fail-unknown-credential-identifier",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        await sendOfferToTestRunner(testInstance);

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        expect(logResult.result).toBe("PASSED");
    }, 10000);

    // ============================================================================
    // FAIL TESTS - Security and Protocol Compliance
    // ============================================================================

    test("oid4vci-1_0-issuer-fail-on-access-token-in-query", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID,
            "oid4vci-1_0-issuer-fail-on-access-token-in-query",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        await sendOfferToTestRunner(testInstance);

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        expect(logResult.result).toBe("PASSED");
    }, 10000);

    test("oid4vci-1_0-issuer-fail-unsupported-encryption-algorithm", async () => {
        const testInstance = await oidfSuite.startTest(
            PLAN_ID,
            "oid4vci-1_0-issuer-fail-unsupported-encryption-algorithm",
        );

        console.log(
            `Test details: ${OIDF_URL}/log-detail.html?log=${testInstance.id}`,
        );

        await sendOfferToTestRunner(testInstance);

        const logResult = await oidfSuite.waitForFinished(testInstance.id);
        expect(logResult.result).toBe("PASSED");
    }, 10000);
});
