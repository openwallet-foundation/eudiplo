import { INestApplication } from "@nestjs/common";
import {
    clientAuthenticationAnonymous,
    Jwk,
    JwtSignerJwk,
} from "@openid4vc/oauth2";
import {
    extractScopesForCredentialConfigurationIds,
    Openid4vciClient,
} from "@openid4vc/openid4vci";
import { digest } from "@owf/crypto";
import { SDJwtVcInstance } from "@sd-jwt/sd-jwt-vc";
import { exportJWK, generateKeyPair } from "jose";
import request from "supertest";
import { App } from "supertest/types";
import { Agent, fetch, setGlobalDispatcher } from "undici";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
    callbacks,
    getSignJwtCallback,
    IssuanceTestContext,
    setupIssuanceTestApp,
    startMockAuthorizationServer,
} from "../utils";
import { OfferRequestDto } from "../../src/issuer/issuance/oid4vci/dto/offer-request.dto";

setGlobalDispatcher(
    new Agent({
        connect: {
            rejectUnauthorized: false,
        },
    }),
);

describe("Issuance - Authorization Code Flow", () => {
    let app: INestApplication<App>;
    let authToken: string;
    let externalAuthorizationServerUrl: string;
    let ctx: IssuanceTestContext;

    const sdjwt = new SDJwtVcInstance({
        hasher: digest,
        hashAlg: "sha-256",
    });

    beforeAll(async () => {
        ctx = await setupIssuanceTestApp();
        app = ctx.app;
        authToken = ctx.authToken;
        externalAuthorizationServerUrl = ctx.externalAuthorizationServerUrl;
    });

    afterAll(async () => {
        await app.close();
    });

    test("authorized code flow ignores built-in authorization server when another server is configured", async () => {
        await request(app.getHttpServer())
            .post("/issuer/config")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                authorizationServers: [
                    { id: "issuer-built-in", type: "built-in" },
                    {
                        id: "issuer-external",
                        type: "external",
                        issuer: externalAuthorizationServerUrl,
                        sessionBinding: {
                            method: "access_token_claim",
                            claim: "issuer_state",
                        },
                    },
                ],
            })
            .expect(201);

        const offerResponse = await request(app.getHttpServer())
            .post("/issuer/offer")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                response_type: "uri",
                credentialConfigurationIds: ["pid-no-key"],
                flow: "authorization_code",
            })
            .expect(201);

        const client = new Openid4vciClient({
            callbacks: {
                ...callbacks,
                clientAuthentication: clientAuthenticationAnonymous(),
            },
        });
        const credentialOffer = await client.resolveCredentialOffer(
            offerResponse.body.uri,
        );

        expect(credentialOffer.grants?.authorization_code).toMatchObject({
            authorization_server: externalAuthorizationServerUrl,
        });
    });

    test("authorized code flow rejects built-in authorization server override", async () => {
        await request(app.getHttpServer())
            .post("/issuer/offer")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                response_type: "uri",
                credentialConfigurationIds: ["pid-no-key"],
                flow: "authorization_code",
                authorization_server: "issuer-built-in",
            })
            .expect(400)
            .expect(({ body }) => {
                expect(body.message).toContain("authorization server");
            });
    });

    test("authorized code flow", async () => {
        const body: OfferRequestDto = {
            response_type: "uri",
            credentialConfigurationIds: ["pid-no-key"],
            flow: "authorization_code",
            credentialClaims: {
                "pid-no-key": {
                    type: "attributeProvider",
                    attributeProviderId: "citizen-ap",
                },
            },
        };

        const offerResponse = await request(app.getHttpServer())
            .post("/issuer/offer")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send(body);
        expect(offerResponse.status).toBe(201);

        const holderKeyPair = await generateKeyPair("ES256", {
            extractable: true,
        });
        const holderPrivateKeyJwk = await exportJWK(holderKeyPair.privateKey);
        const holderPublicKeyJwk = await exportJWK(holderKeyPair.publicKey);

        const client = new Openid4vciClient({
            callbacks: {
                ...callbacks,
                clientAuthentication: clientAuthenticationAnonymous(),
                signJwt: getSignJwtCallback([holderPrivateKeyJwk as Jwk]),
            },
        });
        const credentialOffer = await client.resolveCredentialOffer(
            offerResponse.body.uri,
        );

        const issuerMetadata = await client.resolveIssuerMetadata(
            credentialOffer.credential_issuer,
        );

        const dpopSigner = {
            method: "jwk",
            alg: "ES256",
            publicJwk: holderPublicKeyJwk,
        } as JwtSignerJwk;

        const clientId = "wallet";
        const redirectUri = "http://127.0.0.1:3000/callback";
        const pkceCodeVerifier = "random-code-verifier";

        const { authorizationRequestUrl, pkce } =
            await client.createAuthorizationRequestUrlFromOffer({
                clientId,
                issuerMetadata,
                redirectUri,
                credentialOffer,
                pkceCodeVerifier,
                scope: extractScopesForCredentialConfigurationIds({
                    credentialConfigurationIds:
                        credentialOffer.credential_configuration_ids,
                    issuerMetadata,
                })?.join(" "),
            });
        // Get the authorization code, in this setup it will return a redirect with the URL
        const result = await fetch(authorizationRequestUrl);
        const authorizationCode = new URL(result.url).searchParams.get("code")!;
        const { accessTokenResponse, dpop } =
            await client.retrieveAuthorizationCodeAccessTokenFromOffer({
                issuerMetadata,
                authorizationCode,
                credentialOffer,
                pkceCodeVerifier: pkce?.codeVerifier,
                dpop: {
                    nonce: "random-nonce",
                    signer: dpopSigner,
                },
                redirectUri,
            });

        // Request nonce from the nonce endpoint (OID4VCI spec)
        const nonceResponse = await client.requestNonce({ issuerMetadata });

        const { jwt: proofJwt } = await client.createCredentialRequestJwtProof({
            issuerMetadata,
            signer: {
                method: "jwk",
                alg: "ES256",
                publicJwk: holderPublicKeyJwk,
            } as JwtSignerJwk,
            clientId,
            issuedAt: new Date(),
            credentialConfigurationId:
                credentialOffer.credential_configuration_ids[0],
            nonce: nonceResponse.c_nonce,
        });

        const credentialResponse = await client.retrieveCredentials({
            accessToken: accessTokenResponse.access_token,
            credentialConfigurationId:
                credentialOffer.credential_configuration_ids[0],
            issuerMetadata,
            dpop: {
                ...dpop,
                signer: dpopSigner,
            },
            proof: {
                proof_type: "jwt",
                jwt: proofJwt,
            },
        });

        const credential: string = (
            credentialResponse.credentialResponse.credentials?.[0] as any
        ).credential;
        expect(credential).toBeDefined();

        const claims: any = await sdjwt.getClaims(credential);

        // exp need to be defined
        expect(claims.exp).toBeDefined();
        // lifetime should be 1 week (604800 seconds)
        expect(claims.exp - claims.iat).toBe(604800);
        // status should be defined
        expect(claims.status).toBeDefined();
        // check that a key is present in the cnf
        expect(claims.cnf).toBeDefined();

        await client
            .sendNotification({
                issuerMetadata,
                notification: {
                    notificationId:
                        credentialResponse.credentialResponse.notification_id!,
                    event: "credential_accepted",
                },
                accessToken: accessTokenResponse.access_token,
                dpop: {
                    ...dpop,
                    signer: dpopSigner,
                },
            })
            .catch((err) => {
                console.error("Error sending notification:", err);
                throw err;
            });
        const session = await request(app.getHttpServer())
            .get(`/session/${offerResponse.body.session}`)
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`);
        expect(session.body.externalIssuer).toBe(
            externalAuthorizationServerUrl,
        );
        expect(session.body.externalSubject).toBe("wallet");
        const notificationObj = session.body.notifications.find(
            (notification: any) =>
                notification.id ===
                credentialResponse.credentialResponse.notification_id,
        );
        expect(notificationObj).toBeDefined();
        expect(notificationObj.event).toBe("credential_accepted");
    });

    test("external AS token without configured session-binding claim is rejected", async () => {
        await request(app.getHttpServer())
            .post("/issuer/config")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                authorizationServers: [
                    {
                        id: "issuer-external",
                        type: "external",
                        issuer: externalAuthorizationServerUrl,
                        sessionBinding: {
                            method: "access_token_claim",
                            claim: "missing_issuer_state",
                        },
                    },
                ],
                dPopRequired: false,
            })
            .expect(201);

        const offerResponse = await request(app.getHttpServer())
            .post("/issuer/offer")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                response_type: "uri",
                credentialConfigurationIds: ["pid-no-key"],
                flow: "authorization_code",
            })
            .expect(201);

        const holderKeyPair = await generateKeyPair("ES256", {
            extractable: true,
        });
        const holderPrivateKeyJwk = await exportJWK(holderKeyPair.privateKey);
        const holderPublicKeyJwk = await exportJWK(holderKeyPair.publicKey);

        const client = new Openid4vciClient({
            callbacks: {
                ...callbacks,
                clientAuthentication: clientAuthenticationAnonymous(),
                signJwt: getSignJwtCallback([holderPrivateKeyJwk as Jwk]),
            },
        });

        const credentialOffer = await client.resolveCredentialOffer(
            offerResponse.body.uri,
        );
        const issuerMetadata = await client.resolveIssuerMetadata(
            credentialOffer.credential_issuer,
        );

        const { authorizationRequestUrl, pkce } =
            await client.createAuthorizationRequestUrlFromOffer({
                clientId: "wallet",
                issuerMetadata,
                redirectUri: "http://127.0.0.1:3000/callback",
                credentialOffer,
                pkceCodeVerifier: "random-code-verifier",
                scope: extractScopesForCredentialConfigurationIds({
                    credentialConfigurationIds:
                        credentialOffer.credential_configuration_ids,
                    issuerMetadata,
                })?.join(" "),
            });

        const result = await fetch(authorizationRequestUrl);
        const authorizationCode = new URL(result.url).searchParams.get("code")!;
        const { accessTokenResponse } =
            await client.retrieveAuthorizationCodeAccessTokenFromOffer({
                issuerMetadata,
                authorizationCode,
                credentialOffer,
                pkceCodeVerifier: pkce?.codeVerifier,
                redirectUri: "http://127.0.0.1:3000/callback",
            });

        const nonceResponse = await client.requestNonce({ issuerMetadata });
        const { jwt: proofJwt } = await client.createCredentialRequestJwtProof({
            issuerMetadata,
            signer: {
                method: "jwk",
                alg: "ES256",
                publicJwk: holderPublicKeyJwk,
            } as JwtSignerJwk,
            clientId: "wallet",
            issuedAt: new Date(),
            credentialConfigurationId:
                credentialOffer.credential_configuration_ids[0],
            nonce: nonceResponse.c_nonce,
        });

        await request(app.getHttpServer())
            .post("/issuers/root/vci/credential")
            .trustLocalhost()
            .set("Authorization", `Bearer ${accessTokenResponse.access_token}`)
            .send({
                credential_configuration_id:
                    credentialOffer.credential_configuration_ids[0],
                proof: {
                    proof_type: "jwt",
                    jwt: proofJwt,
                },
            })
            .expect(400)
            .expect(({ body }) => {
                expect(body.error).toBe("credential_request_denied");
            });
    });

    test("external AS token with malformed session-binding claim is rejected", async () => {
        await request(app.getHttpServer())
            .post("/issuer/config")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                authorizationServers: [
                    {
                        id: "issuer-external",
                        type: "external",
                        issuer: externalAuthorizationServerUrl,
                        sessionBinding: {
                            method: "access_token_claim",
                            claim: "sub",
                        },
                    },
                ],
                dPopRequired: false,
            })
            .expect(201);

        const offerResponse = await request(app.getHttpServer())
            .post("/issuer/offer")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                response_type: "uri",
                credentialConfigurationIds: ["pid-no-key"],
                flow: "authorization_code",
            })
            .expect(201);

        const holderKeyPair = await generateKeyPair("ES256", {
            extractable: true,
        });
        const holderPrivateKeyJwk = await exportJWK(holderKeyPair.privateKey);
        const holderPublicKeyJwk = await exportJWK(holderKeyPair.publicKey);

        const client = new Openid4vciClient({
            callbacks: {
                ...callbacks,
                clientAuthentication: clientAuthenticationAnonymous(),
                signJwt: getSignJwtCallback([holderPrivateKeyJwk as Jwk]),
            },
        });

        const credentialOffer = await client.resolveCredentialOffer(
            offerResponse.body.uri,
        );
        const issuerMetadata = await client.resolveIssuerMetadata(
            credentialOffer.credential_issuer,
        );

        const { authorizationRequestUrl, pkce } =
            await client.createAuthorizationRequestUrlFromOffer({
                clientId: "wallet",
                issuerMetadata,
                redirectUri: "http://127.0.0.1:3000/callback",
                credentialOffer,
                pkceCodeVerifier: "random-code-verifier",
                scope: extractScopesForCredentialConfigurationIds({
                    credentialConfigurationIds:
                        credentialOffer.credential_configuration_ids,
                    issuerMetadata,
                })?.join(" "),
            });

        const result = await fetch(authorizationRequestUrl);
        const authorizationCode = new URL(result.url).searchParams.get("code")!;
        const { accessTokenResponse } =
            await client.retrieveAuthorizationCodeAccessTokenFromOffer({
                issuerMetadata,
                authorizationCode,
                credentialOffer,
                pkceCodeVerifier: pkce?.codeVerifier,
                redirectUri: "http://127.0.0.1:3000/callback",
            });

        const nonceResponse = await client.requestNonce({ issuerMetadata });
        const { jwt: proofJwt } = await client.createCredentialRequestJwtProof({
            issuerMetadata,
            signer: {
                method: "jwk",
                alg: "ES256",
                publicJwk: holderPublicKeyJwk,
            } as JwtSignerJwk,
            clientId: "wallet",
            issuedAt: new Date(),
            credentialConfigurationId:
                credentialOffer.credential_configuration_ids[0],
            nonce: nonceResponse.c_nonce,
        });

        await request(app.getHttpServer())
            .post("/issuers/root/vci/credential")
            .trustLocalhost()
            .set("Authorization", `Bearer ${accessTokenResponse.access_token}`)
            .send({
                credential_configuration_id:
                    credentialOffer.credential_configuration_ids[0],
                proof: {
                    proof_type: "jwt",
                    jwt: proofJwt,
                },
            })
            .expect(400)
            .expect(({ body }) => {
                expect(body.error).toBe("credential_request_denied");
            });
    });

    test("token from a different configured external AS than selected on the offer is rejected", async () => {
        const secondAs = await startMockAuthorizationServer();
        try {
            await request(app.getHttpServer())
                .post("/issuer/config")
                .trustLocalhost()
                .set("Authorization", `Bearer ${authToken}`)
                .send({
                    authorizationServers: [
                        {
                            id: "issuer-external-1",
                            type: "external",
                            issuer: externalAuthorizationServerUrl,
                            sessionBinding: {
                                method: "access_token_claim",
                                claim: "issuer_state",
                            },
                        },
                        {
                            id: "issuer-external-2",
                            type: "external",
                            issuer: secondAs.baseUrl,
                            sessionBinding: {
                                method: "access_token_claim",
                                claim: "issuer_state",
                            },
                        },
                    ],
                    dPopRequired: false,
                })
                .expect(201);

            const offerResponse = await request(app.getHttpServer())
                .post("/issuer/offer")
                .trustLocalhost()
                .set("Authorization", `Bearer ${authToken}`)
                .send({
                    response_type: "uri",
                    credentialConfigurationIds: ["pid-no-key"],
                    flow: "authorization_code",
                    authorization_server: "issuer-external-1",
                })
                .expect(201);

            const holderKeyPair = await generateKeyPair("ES256", {
                extractable: true,
            });
            const holderPrivateKeyJwk = await exportJWK(
                holderKeyPair.privateKey,
            );
            const holderPublicKeyJwk = await exportJWK(holderKeyPair.publicKey);

            const client = new Openid4vciClient({
                callbacks: {
                    ...callbacks,
                    clientAuthentication: clientAuthenticationAnonymous(),
                    signJwt: getSignJwtCallback([holderPrivateKeyJwk as Jwk]),
                },
            });

            const credentialOffer = await client.resolveCredentialOffer(
                offerResponse.body.uri,
            );
            const issuerMetadata = await client.resolveIssuerMetadata(
                credentialOffer.credential_issuer,
            );

            const redirectUri = `${secondAs.baseUrl}/callback`;
            const authorizeUrl = new URL(`${secondAs.baseUrl}/authorize`);
            authorizeUrl.searchParams.set("client_id", "wallet");
            authorizeUrl.searchParams.set("redirect_uri", redirectUri);
            authorizeUrl.searchParams.set("response_type", "code");
            authorizeUrl.searchParams.set("scope", "openid");
            authorizeUrl.searchParams.set("state", "state");
            authorizeUrl.searchParams.set(
                "issuer_state",
                offerResponse.body.session,
            );

            const authorizeResponse = await fetch(authorizeUrl.toString());
            const authorizationCode = new URL(
                authorizeResponse.url,
            ).searchParams.get("code");
            expect(authorizationCode).toBeDefined();

            const tokenResponse = await fetch(`${secondAs.baseUrl}/token`, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    grant_type: "authorization_code",
                    code: authorizationCode!,
                    client_id: "wallet",
                    redirect_uri: redirectUri,
                }).toString(),
            });
            const tokenBody = (await tokenResponse.json()) as {
                access_token: string;
            };

            const nonceResponse = await client.requestNonce({ issuerMetadata });
            const { jwt: proofJwt } =
                await client.createCredentialRequestJwtProof({
                    issuerMetadata,
                    signer: {
                        method: "jwk",
                        alg: "ES256",
                        publicJwk: holderPublicKeyJwk,
                    } as JwtSignerJwk,
                    clientId: "wallet",
                    issuedAt: new Date(),
                    credentialConfigurationId:
                        credentialOffer.credential_configuration_ids[0],
                    nonce: nonceResponse.c_nonce,
                });

            await request(app.getHttpServer())
                .post("/issuers/root/vci/credential")
                .trustLocalhost()
                .set("Authorization", `Bearer ${tokenBody.access_token}`)
                .send({
                    credential_configuration_id:
                        credentialOffer.credential_configuration_ids[0],
                    proof: {
                        proof_type: "jwt",
                        jwt: proofJwt,
                    },
                })
                .expect(400)
                .expect(({ body }) => {
                    expect(body.error).toBe("credential_request_denied");
                });
        } finally {
            await secondAs.close();
        }
    });
});
