import crypto from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join, resolve } from "node:path";
import { INestApplication } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import {
    CallbackContext,
    Jwk,
    JwtHeader,
    SignJwtCallback,
} from "@openid4vc/oauth2";
import { ResolvedOpenid4vpAuthorizationRequest } from "@openid4vc/openid4vp";
import {
    CoseKey,
    DeviceKey,
    DeviceRequest,
    DocRequest,
    Holder,
    Issuer,
    IssuerSigned,
    ItemsRequest,
    SessionTranscript,
    SignatureAlgorithm,
} from "@owf/mdoc";
import { X509Certificate } from "@peculiar/x509";
import { digest, ES256 } from "@owf/crypto";
import { SDJwtVcInstance } from "@sd-jwt/sd-jwt-vc";
import { kbPayload } from "@sd-jwt/core";
import {
    calculateJwkThumbprint,
    EncryptJWT,
    exportJWK,
    importJWK,
    importX509,
    JWK,
    jwtVerify,
    SignJWT,
} from "jose";
import request from "supertest";
import { createAppValidationPipe } from "../src/shared/common/zod/zod-schema.util";
import { App } from "supertest/types";
import { AppModule } from "../src/app.module";
import { Role } from "../src/auth/roles/role.enum";
import { KeyChainImportDto } from "../src/crypto/key/dto/key-chain-import.dto";
import { KeyChainService } from "../src/crypto/key/key-chain.service";
import { CredentialConfigCreate } from "../src/issuer/configuration/credentials/dto/credential-config-create.dto";
import { IssuanceDto } from "../src/issuer/configuration/issuance/dto/issuance.dto";
import { StatusListService } from "../src/issuer/lifecycle/status/status-list.service";
import { TrustListCreateDto } from "../src/issuer/trust-list/dto/trust-list-create.dto";
import { PresentationRequest } from "../src/verifier/oid4vp/dto/presentation-request.dto";
import { PresentationConfigCreateDto } from "../src/verifier/presentations/dto/presentation-config-create.dto";
import { DEVICE_JWK, mdocContext } from "./utils-mdoc";
import { CreateWebhookEndpointDto } from "../src/issuer/configuration/webhook-endpoint/dto/create-webhook-endpoint.dto";

export function readConfig<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf-8"));
}

export async function prepareMdocPresentation(
    nonce: string,
    privateKey: CryptoKey,
    issuerCert: string,
    clientId: string,
    responseUri: string,
    responseMode: string = "direct_post.jwt",
    jwkThumbprint?: Uint8Array,
    mdocStatus?: {
        statusList: {
            idx: number;
            uri: string;
        };
    },
) {
    // Use the EU PID docType and namespace to match the pid-de fixture
    const docType = "eu.europa.ec.eudi.pid.1";
    const namespace = "eu.europa.ec.eudi.pid.1";

    const issuer = new Issuer(docType, mdocContext);

    const signed = new Date();
    const validFrom = new Date(signed);
    const validUntil = new Date(signed);
    validUntil.setFullYear(signed.getFullYear() + 30);

    // Add claims with the correct names expected by the DCQL query
    issuer.addIssuerNamespace(namespace, {
        given_name: "First",
        family_name: "Last",
        first_name: "First", // Keep for backward compatibility
        last_name: "Last", // Keep for backward compatibility
    });

    //TODO: get key from eudiplo so it matches with the trust list
    const key = await exportJWK(privateKey);

    const issuerSigned = await issuer.sign({
        signingKey: CoseKey.fromJwk(key as Jwk),
        certificates: [new Uint8Array(new X509Certificate(issuerCert).rawData)],
        algorithm: SignatureAlgorithm.ES256,
        digestAlgorithm: "SHA-256",
        deviceKeyInfo: { deviceKey: DeviceKey.fromJwk(DEVICE_JWK) },
        validityInfo: { signed, validFrom, validUntil },
        status: mdocStatus,
    });

    const encodedIssuerSigned = issuerSigned.encodedForOid4Vci;

    // openid4vci protocol

    const credential = IssuerSigned.fromEncodedForOid4Vci(encodedIssuerSigned);

    const deviceRequest = DeviceRequest.create({
        docRequests: [
            DocRequest.create({
                itemsRequest: ItemsRequest.create({
                    docType: docType,
                    namespaces: {
                        [namespace]: {
                            given_name: true,
                            family_name: true,
                            first_name: true,
                            last_name: true,
                        },
                    },
                }),
            }),
        ],
    });

    const sessionTranscript = await SessionTranscript.forOid4Vp(
        {
            protocol: "openid4vp",
            clientId,
            responseUri,
            nonce,
            responseMode,
            ...(jwkThumbprint ? { jwkThumbprint } : {}),
        },
        mdocContext,
    );

    const deviceResponse = await Holder.createDeviceResponseForDeviceRequest(
        {
            deviceRequest,
            issuerSigned: [credential],
            sessionTranscript,
            signature: {
                signingKey: CoseKey.fromJwk({ ...DEVICE_JWK, alg: "ES256" }),
            },
        },
        mdocContext,
    );

    return deviceResponse.encodedForOid4Vp;
}

async function createCredential(options: {
    claims: any;
    privateKey: CryptoKey;
    x5c: string[];
}) {
    //create keypair for holder
    const { privateKeyHolder, publicKeyHolder } =
        await ES256.generateKeyPair().then((keyPair) => ({
            privateKeyHolder: keyPair.privateKey,
            publicKeyHolder: keyPair.publicKey,
        }));

    const sdjwt = new SDJwtVcInstance({
        signer: async (data: string) => {
            const encoder = new TextEncoder();
            const signature = await globalThis.crypto.subtle.sign(
                { name: "ECDSA", hash: "SHA-256" },
                options.privateKey,
                encoder.encode(data),
            );

            return btoa(String.fromCodePoint(...new Uint8Array(signature)))
                .replaceAll("+", "-")
                .replaceAll("/", "_")
                .replace(/=+$/, ""); // Convert to base64url format
        },
        signAlg: "ES256",
        hasher: digest,
        loadTypeMetadataFormat: true,
        saltGenerator: (length: number) =>
            crypto.randomBytes(length).toString("base64url"),
    });

    return sdjwt
        .issue(
            {
                ...options.claims,
                cnf: { jwk: publicKeyHolder },
            },
            undefined,
            {
                header: {
                    x5c: options.x5c,
                },
            },
        )
        .then((credential) => ({
            credential,
            privateKey: privateKeyHolder,
        }));
}

export async function preparePresentation(
    kb: Omit<kbPayload, "sd_hash">,
    privateKey: CryptoKey,
    x5c: string[],
    statusListService: StatusListService,
    credentialConfigId: string,
) {
    const status = await statusListService.createEntry(
        { tenantId: "root", id: "1" } as any,
        credentialConfigId,
    );

    const credential = await createCredential({
        claims: {
            vct: "http://localhost:3000/issuers/demo/credentials-metadata/vct/pid",
            status,
            // Include claims that can be selectively disclosed
            birthdate: "1990-01-01",
            address: {
                locality: "Berlin",
                country: "DE",
            },
        },
        privateKey,
        x5c,
    });

    const sdjwt = new SDJwtVcInstance({
        hasher: digest,
        kbSigner: await ES256.getSigner(credential.privateKey),
        kbSignAlg: "ES256",
    });
    const presentation = await sdjwt.present(
        credential.credential,
        {
            birthdate: true,
            address: {
                locality: true,
            },
        },
        {
            kb: {
                payload: kb,
            },
        },
    );
    return presentation;
}

export const callbacks: any = {
    fetch: async (url, options) => {
        const response = await fetch(url, options);
        return response;
    },
    hash: (data, alg) =>
        crypto
            .createHash(alg.replace("-", "").toLowerCase())
            .update(data)
            .digest(),
    generateRandom: (bytes) => crypto.randomBytes(bytes),
    /* clientAuthentication: clientAuthenticationNone({
        clientId: 'some-random-client-id',
    }), */
    verifyJwt: async (signer, { compact, payload }) => {
        let jwk: Jwk;
        let publicKey: CryptoKey;
        if (signer.method === "jwk") {
            jwk = signer.publicJwk;
            publicKey = (await importJWK(jwk as JWK, signer.alg)) as CryptoKey;
        } else if (signer.method === "x5c") {
            const headerB64 = compact.split(".")[0];
            const header: JwtHeader = JSON.parse(
                Buffer.from(headerB64, "base64url").toString(),
            );
            if (!header.x5c || header.x5c.length === 0) {
                throw new Error("x5c header parameter is missing or empty");
            }
            const certPem = `-----BEGIN CERTIFICATE-----\n${header.x5c[0]}\n-----END CERTIFICATE-----`;
            publicKey = await importX509(certPem, signer.alg);
            jwk = (await exportJWK(publicKey)) as Jwk;
        } else {
            throw new Error("Signer method not supported");
        }

        try {
            await jwtVerify(compact, publicKey, {
                currentDate: payload.exp
                    ? new Date((payload.exp - 300) * 1000)
                    : undefined,
            });
            return {
                verified: true,
                signerJwk: jwk,
            };
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_error) {
            return {
                verified: false,
            };
        }
    },
    getX509CertificateMetadata: (
        certificate: string,
    ): {
        sanDnsNames: string[];
        sanUriNames: string[];
    } => {
        const cert1 = new crypto.X509Certificate(
            `-----BEGIN CERTIFICATE-----\n${certificate}\n-----END CERTIFICATE-----`,
        );
        const sanDnsNames = cert1
            .subjectAltName!.split(",")
            .map((name) => name.replace("DNS:", "").trim());
        const sanUriNames = [];

        return {
            sanDnsNames,
            sanUriNames,
        };
    },
} as const satisfies Partial<CallbackContext>;

export const getSignJwtCallback = (privateJwks: Jwk[]): SignJwtCallback => {
    return async (signer, { header, payload }) => {
        let jwk: Jwk;
        if (signer.method === "jwk") {
            jwk = signer.publicJwk;
        } else {
            throw new Error("Signer method not supported");
        }

        const jwkThumprint = await calculateJwkThumbprint(jwk as JWK, "sha256");

        // add cnf
        payload.cnf = {
            jkt: jwkThumprint,
        };

        const privateJwk = await Promise.all(
            privateJwks.map(async (jwk) =>
                (await calculateJwkThumbprint(jwk as JWK, "sha256")) ===
                jwkThumprint
                    ? jwk
                    : undefined,
            ),
        ).then((jwks) => jwks.find((jwk) => jwk !== undefined));

        if (!privateJwk) {
            throw new Error(
                `No private key available for public jwk \n${JSON.stringify(jwk, null, 2)}`,
            );
        }

        const josePrivateKey = await importJWK(privateJwk as JWK, signer.alg);
        const jwt = await new SignJWT(payload)
            .setProtectedHeader(header)
            .sign(josePrivateKey);

        return {
            jwt: jwt,
            signerJwk: jwk,
        };
    };
};

/**
 * Creates a tenant and returns the access token for a client.
 * @param app
 * @param clientId
 * @param clientSecret
 * @param tenantId - Optional tenant ID, defaults to "root"
 * @returns
 */
export async function getToken(
    app: INestApplication,
    clientId: string,
    clientSecret: string,
    tenantId = "root",
) {
    // Get JWT token using client credentials
    const tokenResponse = await request(app.getHttpServer())
        .post("/api/oauth2/token")
        .trustLocalhost()
        .send({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "client_credentials",
        })
        .expect(201);
    const authToken = tokenResponse.body.access_token;
    expect(authToken).toBeDefined();

    // create tenant
    const client = await request(app.getHttpServer())
        .post("/tenant")
        .trustLocalhost()
        .set("Authorization", `Bearer ${authToken}`)
        .send({
            id: tenantId,
            name: `${tenantId.charAt(0).toUpperCase() + tenantId.slice(1)} Tenant`,
            roles: [
                Role.Clients,
                Role.IssuanceOffer,
                Role.Issuances,
                Role.PresentationRequest,
                Role.Presentations,
            ],
        })
        .then((res) => res.body.client);

    return request(app.getHttpServer())
        .post("/api/oauth2/token")
        .trustLocalhost()
        .send({
            client_id: client.clientId,
            client_secret: client.clientSecret,
            grant_type: "client_credentials",
        })
        .then((res) => res.body.access_token);
}

export function getDefaultSecret(input: string): string {
    const pattern = /\$\{([A-Z0-9_]+)(?::([^}]*))?\}/g;
    return input.replaceAll(
        pattern,
        (fullMatch, varName: string, defVal: string) => {
            return defVal;
        },
    );
}

/**
 * Shared test context returned by setupIssuanceTestApp
 */
export interface IssuanceTestContext {
    app: INestApplication<App>;
    authToken: string;
    clientId: string;
    clientSecret: string;
    externalAuthorizationServerUrl: string;
}

/**
 * Sets up a complete test application with all issuance configurations.
 * This is a shared setup for all issuance-related e2e tests.
 */
export async function setupIssuanceTestApp(): Promise<IssuanceTestContext> {
    // Delete the database
    rmSync("../../tmp/service.db", { force: true });

    const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createAppValidationPipe());

    const configService = app.get(ConfigService);
    configService.set("CONFIG_IMPORT", false);
    configService.set("LOG_LEVEL", "debug");
    const clientId = configService.getOrThrow<string>("AUTH_CLIENT_ID");
    const clientSecret = configService.getOrThrow<string>("AUTH_CLIENT_SECRET");

    await app.init();
    await app.listen(3000);

    const authToken = await getToken(app, clientId, clientSecret);

    const { baseUrl: fakeAuthServer, close: closeFakeAuthServer } =
        await startMockAuthorizationServer();
    const originalClose = app.close.bind(app);
    app.close = (async () => {
        try {
            await closeFakeAuthServer();
        } finally {
            await originalClose();
        }
    }) as typeof app.close;

    const configFolder = resolve(__dirname + "/fixtures");

    // Create attestation key chain for credential signing
    await request(app.getHttpServer())
        .post("/key-chain/import")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
            ...readConfig<KeyChainImportDto>(
                join(configFolder, "haip/key-chains/attestation.json"),
            ),
        })
        .expect(201);

    // Create access key chain for access tokens
    await request(app.getHttpServer())
        .post("/key-chain/import")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
            ...readConfig<KeyChainImportDto>(
                join(configFolder, "haip/key-chains/access.json"),
            ),
        })
        .expect(201);

    // Create status list key chain
    await request(app.getHttpServer())
        .post("/key-chain/import")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
            ...readConfig<KeyChainImportDto>(
                join(configFolder, "haip/key-chains/status-list.json"),
            ),
        })
        .expect(201);

    // Create trust list key chain
    await request(app.getHttpServer())
        .post("/key-chain/import")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
            ...readConfig<KeyChainImportDto>(
                join(configFolder, "haip/key-chains/trust-list.json"),
            ),
        })
        .expect(201);

    // Import image
    await request(app.getHttpServer())
        .post("/storage")
        .trustLocalhost()
        .set("Authorization", `Bearer ${authToken}`)
        .attach("file", join(configFolder, "haip/images/company.png"))
        .expect(201);

    // Import issuance config (disable wallet attestation for non-OIDF tests)
    await request(app.getHttpServer())
        .post("/issuer/config")
        .trustLocalhost()
        .set("Authorization", `Bearer ${authToken}`)
        .send({
            ...readConfig<IssuanceDto>(
                join(configFolder, "haip/issuance/issuance.json"),
            ),
            authorizationServers: [
                { id: "issuer-built-in", type: "built-in" },
                {
                    id: "issuer-external",
                    type: "external",
                    issuer: fakeAuthServer,
                },
            ],
            dPopRequired: false,
            credentialResponseEncryption: false,
            credentialRequestEncryption: false,
            walletAttestationRequired: false,
        } as IssuanceDto)
        .expect(201);

    // Import the pid credential configuration

    await request(app.getHttpServer())
        .post("/issuer/credentials")
        .trustLocalhost()
        .set("Authorization", `Bearer ${authToken}`)
        .send(
            readConfig<CredentialConfigCreate>(
                join(configFolder, "haip/issuance/credentials/pid-no-key.json"),
            ),
        )
        .expect(201);

    // Import citizen presentation config
    await request(app.getHttpServer())
        .post("/verifier/config")
        .trustLocalhost()
        .set("Authorization", `Bearer ${authToken}`)
        .send(
            readConfig<PresentationConfigCreateDto>(
                join(configFolder, "haip/presentation/pid.json"),
            ),
        )
        .expect(201);

    // Import the citizen attribute provider
    await request(app.getHttpServer())
        .post("/issuer/attribute-providers")
        .trustLocalhost()
        .set("Authorization", `Bearer ${authToken}`)
        .send(
            readConfig(
                join(
                    configFolder,
                    "haip/issuance/attribute-providers/citizen-ap.json",
                ),
            ),
        )
        .expect(201);

    // Import the citizen credential configuration
    await request(app.getHttpServer())
        .post("/issuer/credentials")
        .trustLocalhost()
        .set("Authorization", `Bearer ${authToken}`)
        .send(
            readConfig<CredentialConfigCreate>(
                join(configFolder, "haip/issuance/credentials/citizen.json"),
            ),
        )
        .expect(201);

    // Import mDOC credential configuration
    await request(app.getHttpServer())
        .post("/issuer/credentials")
        .trustLocalhost()
        .set("Authorization", `Bearer ${authToken}`)
        .send(
            readConfig<CredentialConfigCreate>(
                join(configFolder, "haip/issuance/credentials/pid-mdoc.json"),
            ),
        )
        .expect(201);

    await request(app.getHttpServer())
        .post("/issuer/credentials")
        .trustLocalhost()
        .set("Authorization", `Bearer ${authToken}`)
        .send(
            readConfig<CredentialConfigCreate>(
                join(
                    configFolder,
                    "haip/issuance/credentials/pid-mdoc-no-key.json",
                ),
            ),
        )
        .expect(201);

    return {
        app,
        authToken,
        clientId,
        clientSecret,
        externalAuthorizationServerUrl: fakeAuthServer,
    };
}

/**
 * Shared test context returned by setupPresentationTestApp
 */
export interface PresentationTestContext {
    app: INestApplication<App>;
    authToken: string;
    host: string;
    clientId: string;
    clientSecret: string;
    privateIssuerKey: CryptoKey;
    issuerCert: string;
    /** Full certificate chain as base64 DER values (ready for x5c header) */
    issuerCertChain: string[];
    statusListService: StatusListService;
}

/**
 * Sets up a complete test application for presentation e2e tests.
 * This includes keys, certificates, presentation configs, and trust lists.
 */
export async function setupPresentationTestApp(): Promise<PresentationTestContext> {
    // Delete the database
    rmSync("../../tmp/service.db", { force: true });

    const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    app.useGlobalPipes(createAppValidationPipe());

    const configService = app.get(ConfigService);
    const configFolder = resolve(__dirname + "/fixtures");
    configService.set("CONFIG_FOLDER", configFolder);
    const host = configService.getOrThrow("PUBLIC_URL");
    const clientId = configService.getOrThrow<string>("AUTH_CLIENT_ID");
    const clientSecret = configService.getOrThrow<string>("AUTH_CLIENT_SECRET");

    const statusListService = app.get(StatusListService);

    await app.init();
    await app.listen(3000);

    const authToken = await getToken(app, clientId, clientSecret);

    // Helper to make requests and show detailed error on failure
    async function expectRequest(
        req: request.Test,
        expectedStatus: number,
    ): Promise<request.Response> {
        const res = await req;
        if (res.status !== expectedStatus) {
            console.error(
                `Request failed: expected ${expectedStatus}, got ${res.status} for endpoint ${req.url}`,
            );
            console.error("Response body:", JSON.stringify(res.body, null, 2));
        }
        expect(res.status).toBe(expectedStatus);
        return res;
    }

    // Import access key chain (for OAuth/authentication)
    const accessKeyChain = readConfig<KeyChainImportDto>(
        join(configFolder, "haip/key-chains/access.json"),
    );

    await expectRequest(
        request(app.getHttpServer())
            .post("/key-chain/import")
            .set("Authorization", `Bearer ${authToken}`)
            .send(accessKeyChain),
        201,
    );

    // Import presentation configuration without webhook
    await expectRequest(
        request(app.getHttpServer())
            .post("/verifier/config")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send(
                readConfig<PresentationConfigCreateDto>(
                    join(configFolder, "haip/presentation/pid-no-hook.json"),
                ),
            ),
        201,
    );

    // Import status list key chain
    const statusListKeyChain = readConfig<KeyChainImportDto>(
        join(configFolder, "haip/key-chains/status-list.json"),
    );

    await expectRequest(
        request(app.getHttpServer())
            .post("/key-chain/import")
            .set("Authorization", `Bearer ${authToken}`)
            .send(statusListKeyChain),
        201,
    );

    // Import trust list key chain
    const trustListKeyChain = readConfig<KeyChainImportDto>(
        join(configFolder, "haip/key-chains/trust-list.json"),
    );

    await expectRequest(
        request(app.getHttpServer())
            .post("/key-chain/import")
            .set("Authorization", `Bearer ${authToken}`)
            .send(trustListKeyChain),
        201,
    );

    // Import attestation key chain (referenced by trust list entities for credential signing)
    const attestationKeyChain = readConfig<KeyChainImportDto>(
        join(configFolder, "haip/key-chains/attestation.json"),
    );

    await expectRequest(
        request(app.getHttpServer())
            .post("/key-chain/import")
            .set("Authorization", `Bearer ${authToken}`)
            .send(attestationKeyChain),
        201,
    );

    // Retrieve the active (leaf) key and certificate from the imported attestation key chain.
    // With rotation enabled, the fixture key becomes the root CA and a new leaf key is generated.
    const keyChainService = app.get(KeyChainService);
    const attestationEntity = await keyChainService.getEntity(
        "root",
        attestationKeyChain.id!,
    );
    const privateIssuerKey = (await importJWK(
        attestationEntity.activeJwk,
        "ES256",
        { extractable: true },
    )) as CryptoKey;

    // Split the certificate chain into individual PEMs
    const certPems = attestationEntity.activeCertificate.match(
        /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g,
    ) ?? [attestationEntity.activeCertificate];
    const issuerCert = certPems[0]; // leaf PEM (for mdoc)
    const issuerCertChain = certPems.map((pem) =>
        pem
            .replace("-----BEGIN CERTIFICATE-----", "")
            .replace("-----END CERTIFICATE-----", "")
            .replaceAll(/\r?\n|\r/g, ""),
    );

    // Import trust list
    await expectRequest(
        request(app.getHttpServer())
            .post("/trust-list")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send(
                readConfig<TrustListCreateDto>(
                    join(configFolder, "haip/trust-lists/pid-tl.json"),
                ),
            ),
        201,
    );

    // import webhook endpoint for testing webhook calls
    await expectRequest(
        request(app.getHttpServer())
            .post("/issuer/webhook-endpoints")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send(
                readConfig<CreateWebhookEndpointDto>(
                    join(
                        configFolder,
                        "haip/webhook-endpoints/notification.json",
                    ),
                ),
            ),
        201,
    );

    // Import presentation configs for pid-de and pid
    await expectRequest(
        request(app.getHttpServer())
            .post("/verifier/config")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send(
                readConfig<PresentationConfigCreateDto>(
                    join(configFolder, "haip/presentation/pid-de.json"),
                ),
            ),
        201,
    );

    await expectRequest(
        request(app.getHttpServer())
            .post("/verifier/config")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send(
                readConfig<PresentationConfigCreateDto>(
                    join(configFolder, "haip/presentation/pid.json"),
                ),
            ),
        201,
    );

    return {
        app,
        authToken,
        host,
        clientId,
        clientSecret,
        privateIssuerKey,
        issuerCert,
        issuerCertChain,
        statusListService,
    };
}

/**
 * Helper function to encrypt and prepare VP token
 */
export async function encryptVpToken(
    vp_token: string,
    credentialId: string,
    resolved: ResolvedOpenid4vpAuthorizationRequest,
    enc: "A128GCM" | "A256GCM" = "A128GCM",
): Promise<string> {
    const key = (await importJWK(
        resolved.authorizationRequestPayload.client_metadata?.jwks
            ?.keys[0] as JWK,
        "ECDH-ES",
    )) as CryptoKey;

    return new EncryptJWT({
        vp_token: { [credentialId]: [vp_token] },
        state: resolved.authorizationRequestPayload.state!,
    })
        .setProtectedHeader({
            alg: "ECDH-ES",
            enc,
        })
        .setIssuedAt()
        .setExpirationTime("2h")
        .encrypt(key);
}

/**
 * Starts a tiny local authorization server that behaves like an external AS.
 * It serves the metadata endpoints, the authorization redirect endpoint, and the
 * token endpoint, so native fetch clients do not need a fake DNS hostname.
 */
export async function startMockAuthorizationServer(): Promise<{
    baseUrl: string;
    close: () => Promise<void>;
}> {
    let server: Server | undefined;
    const { privateKey, publicKey } = await ES256.generateKeyPair().then(
        (keyPair) => ({
            privateKey: keyPair.privateKey,
            publicKey: keyPair.publicKey,
        }),
    );

    const waitForServer = new Promise<void>((resolve) => {
        server = createServer(async (req, res) => {
            const requestUrl = new URL(req.url ?? "/", "http://127.0.0.1");

            if (
                req.method === "GET" &&
                (requestUrl.pathname ===
                    "/.well-known/oauth-authorization-server" ||
                    requestUrl.pathname === "/.well-known/openid-configuration")
            ) {
                const baseUrl = `http://127.0.0.1:${(server as Server).address() && typeof (server as Server).address() === "object" ? (server as Server).address()!.port : 0}`;
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        issuer: baseUrl,
                        authorization_endpoint: `${baseUrl}/authorize`,
                        token_endpoint: `${baseUrl}/token`,
                        jwks_uri: `${baseUrl}/jwks`,
                        response_types_supported: ["code"],
                        grant_types_supported: ["authorization_code"],
                        code_challenge_methods_supported: ["S256", "plain"],
                        scopes_supported: ["openid"],
                        dpop_signing_alg_values_supported: ["ES256"],
                        token_endpoint_auth_methods_supported: ["none"],
                    }),
                );
                return;
            }

            if (req.method === "GET" && requestUrl.pathname === "/authorize") {
                const redirectUri =
                    requestUrl.searchParams.get("redirect_uri") ??
                    "http://127.0.0.1/callback";
                const state = requestUrl.searchParams.get("state") ?? "state";
                const code = "mock-auth-code";

                const target = new URL(redirectUri);
                target.searchParams.set("code", code);
                target.searchParams.set("state", state);

                res.writeHead(302, {
                    Location: target.toString(),
                });
                res.end();
                return;
            }

            if (req.method === "GET" && requestUrl.pathname === "/jwks") {
                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(
                    JSON.stringify({
                        keys: [{ ...publicKey, kid: "mock-as-key" }],
                    }),
                );
                return;
            }

            if (req.method === "POST" && requestUrl.pathname === "/token") {
                let rawBody = "";
                req.on("data", (chunk) => {
                    rawBody += chunk.toString();
                });
                req.on("end", async () => {
                    const params = new URLSearchParams(rawBody);
                    const grantType = params.get("grant_type");
                    const dpopHeader = req.headers.dpop;
                    const dpopJwt =
                        typeof dpopHeader === "string" ? dpopHeader : undefined;

                    let cnf: Record<string, unknown> | undefined;
                    if (dpopJwt) {
                        const [headerPart] = dpopJwt.split(".");
                        if (headerPart) {
                            const rawHeader = Buffer.from(
                                headerPart
                                    .replace(/-/g, "+")
                                    .replace(/_/g, "/"),
                                "base64",
                            ).toString("utf8");
                            const header = JSON.parse(rawHeader) as {
                                jwk?: Jwk;
                            };
                            if (header.jwk) {
                                const jkt = await calculateJwkThumbprint(
                                    header.jwk,
                                );
                                cnf = { jkt };
                            }
                        }
                    }

                    const now = Math.floor(Date.now() / 1000);
                    const tokenPayload = {
                        iss: `http://127.0.0.1:${(server as Server).address() && typeof (server as Server).address() === "object" ? (server as Server).address()!.port : 0}`,
                        sub: "wallet",
                        aud: "http://localhost:3000/issuers/root",
                        iat: now,
                        exp: now + 3600,
                        jti: crypto.randomUUID(),
                        client_id: "wallet",
                        ...(cnf ? { cnf } : {}),
                        ...(grantType === "authorization_code"
                            ? {
                                  scope: "openid",
                              }
                            : {}),
                    };

                    const accessToken = await new SignJWT(tokenPayload)
                        .setProtectedHeader({
                            alg: "ES256",
                            kid: "mock-as-key",
                            typ: "at+jwt",
                        })
                        .sign(privateKey);

                    const responseBody = {
                        access_token: accessToken,
                        token_type: cnf ? "DPoP" : "Bearer",
                        expires_in: 3600,
                        ...(grantType === "authorization_code"
                            ? {
                                  refresh_token: "mock-refresh-token",
                              }
                            : {}),
                    };

                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify(responseBody));
                });
                return;
            }

            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "not_found" }));
        });

        server.listen(0, "127.0.0.1", () => resolve());
    });

    await waitForServer;

    const address = server?.address();
    if (!server || !address || typeof address === "string") {
        throw new Error("Failed to start mock authorization server");
    }

    const baseUrl = `http://127.0.0.1:${address.port}`;

    return {
        baseUrl,
        close: () =>
            new Promise<void>((resolve, reject) => {
                server?.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    resolve();
                });
            }),
    };
}

/**
 * Creates a test fetch function for Openid4vpClient that routes requests through supertest
 */
export function createTestFetch(
    app: INestApplication<App>,
    getHost: () => string,
) {
    return async (uri: string, init: RequestInit) => {
        const path = uri.split(getHost())[1];
        let response: request.Response;
        if (init.method === "POST") {
            response = await request(app.getHttpServer())
                .post(path)
                .trustLocalhost()
                .send(init.body!);
        } else {
            response = await request(app.getHttpServer())
                .get(path)
                .trustLocalhost();
        }
        return {
            ok: true,
            text: () => response.text,
            json: () => response.body,
            status: response.status,
            headers: response.headers,
        };
    };
}

/**
 * Helper function to create a presentation request via the verifier API
 */
export function createPresentationRequest(
    app: INestApplication<App>,
    authToken: string,
    requestBody: PresentationRequest,
) {
    return request(app.getHttpServer())
        .post("/verifier/offer")
        .trustLocalhost()
        .set("Authorization", `Bearer ${authToken}`)
        .send(requestBody);
}
