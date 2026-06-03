import { INestApplication } from "@nestjs/common";
import {
    clientAuthenticationAnonymous,
    Jwk,
    JwtSignerJwk,
} from "@openid4vc/oauth2";
import {
    type IssuerMetadataResult,
    Openid4vciClient,
} from "@openid4vc/openid4vci";
import { digest } from "@sd-jwt/crypto-nodejs";
import { SDJwtVcInstance } from "@sd-jwt/sd-jwt-vc";
import { exportJWK, generateKeyPair } from "jose";
import nock from "nock";
import request from "supertest";
import { App } from "supertest/types";
import { Agent, setGlobalDispatcher } from "undici";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import {
    callbacks,
    getSignJwtCallback,
    IssuanceTestContext,
    setupIssuanceTestApp,
} from "../utils";

setGlobalDispatcher(
    new Agent({
        connect: {
            rejectUnauthorized: false,
        },
    }),
);

/**
 * Helper function to retrieve deferred credential.
 * The OID4VCI client library doesn't have this method yet.
 */
async function retrieveDeferredCredential(
    app: INestApplication<App>,
    issuerMetadata: IssuerMetadataResult,
    accessToken: string,
    transactionId: string,
): Promise<{ statusCode: number; body: any }> {
    // Use the deferred_credential_endpoint from issuer metadata
    const endpoint =
        issuerMetadata.credentialIssuer.deferred_credential_endpoint;
    if (!endpoint) {
        throw new Error("No deferred_credential_endpoint in issuer metadata");
    }

    // Extract the path from the endpoint URL
    const url = new URL(endpoint);
    const path = url.pathname;

    const response = await request(app.getHttpServer())
        .post(path)
        .trustLocalhost()
        .set("Authorization", `Bearer ${accessToken}`)
        .send({
            transaction_id: transactionId,
        });

    return { statusCode: response.status, body: response.body };
}

setGlobalDispatcher(
    new Agent({
        connect: {
            rejectUnauthorized: false,
        },
    }),
);

describe("Issuance - Deferred Credential Flow", () => {
    let app: INestApplication<App>;
    let authToken: string;
    let clientId: string;
    let ctx: IssuanceTestContext;

    const sdjwt = new SDJwtVcInstance({
        hasher: digest,
        hashAlg: "sha-256",
    });

    beforeAll(async () => {
        ctx = await setupIssuanceTestApp();
        app = ctx.app;
        authToken = ctx.authToken;
        clientId = ctx.clientId;
    });

    afterAll(async () => {
        await app.close();
    });

    test("deferred credential issuance with webhook returning deferred response", async () => {
        const pollingInterval = 2;

        // Mock the webhook server to return a deferred response
        nock("http://localhost:8787")
            .post("/deferred", () => true)
            .reply(200, {
                deferred: true,
                interval: pollingInterval,
            });

        const offerResponse = await request(app.getHttpServer())
            .post("/issuer/offer")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                flow: "pre_authorized_code",
                response_type: "uri",
                credentialConfigurationIds: ["citizen"],
                credentialClaims: {
                    citizen: {
                        type: "webhook",
                        webhook: {
                            url: "http://localhost:8787/deferred",
                            auth: { type: "none" },
                        },
                    },
                },
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

        // Verify that deferred_credential_endpoint is in the metadata
        expect(
            issuerMetadata.credentialIssuer.deferred_credential_endpoint,
        ).toBeDefined();

        const { accessTokenResponse } =
            await client.retrievePreAuthorizedCodeAccessTokenFromOffer({
                credentialOffer,
                issuerMetadata,
            });

        // Request nonce from the nonce endpoint
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

        // Request credential using the client - should get deferred response
        const credentialResponse = await client.retrieveCredentials({
            accessToken: accessTokenResponse.access_token,
            credentialConfigurationId:
                credentialOffer.credential_configuration_ids[0],
            issuerMetadata,
            proofs: {
                jwt: [proofJwt],
            },
        });

        // Verify we got a deferred response (transaction_id)
        expect(
            credentialResponse.credentialResponse.transaction_id,
        ).toBeDefined();
        expect(
            credentialResponse.credentialResponse.credential,
        ).toBeUndefined();

        const transactionId =
            credentialResponse.credentialResponse.transaction_id!;

        // First poll should return issuance_pending error
        const deferredResult1 = await retrieveDeferredCredential(
            app,
            issuerMetadata,
            accessTokenResponse.access_token,
            transactionId,
        );
        expect(deferredResult1.statusCode).toBe(400);
        expect(deferredResult1.body.error).toBe("issuance_pending");

        // Complete the deferred transaction via the API
        const town = "Berlin";
        await request(app.getHttpServer())
            .post(`/issuer/deferred/${transactionId}/complete`)
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                claims: {
                    town,
                },
            })
            .expect(200);

        // Now poll again - should return the credential
        const deferredResult2 = await retrieveDeferredCredential(
            app,
            issuerMetadata,
            accessTokenResponse.access_token,
            transactionId,
        );

        if (deferredResult2.statusCode !== 200) {
            console.log(
                "ERROR: Deferred result2:",
                JSON.stringify(deferredResult2.body, null, 2),
            );
        }
        expect(deferredResult2.statusCode).toBe(200);
        expect(deferredResult2.body.credential).toBeDefined();

        // Verify the credential claims
        const claims = await sdjwt.getClaims(
            deferredResult2.body.credential as string,
        );
        expect(claims.town).toBe(town);

        // Verify the webhook was called
        expect(nock.isDone()).toBe(true);
    });

    test("deferred credential - invalid transaction_id", async () => {
        const holderKeyPair = await generateKeyPair("ES256", {
            extractable: true,
        });
        const holderPrivateKeyJwk = await exportJWK(holderKeyPair.privateKey);
        const _holderPublicKeyJwk = await exportJWK(holderKeyPair.publicKey);

        // Create an offer just to get a valid access token
        const offerResponse = await request(app.getHttpServer())
            .post("/issuer/offer")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                flow: "pre_authorized_code",
                response_type: "uri",
                credentialConfigurationIds: ["pid-no-key"],
            })
            .expect(201);

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

        const { accessTokenResponse } =
            await client.retrievePreAuthorizedCodeAccessTokenFromOffer({
                credentialOffer,
                issuerMetadata,
            });

        // Try to get a deferred credential with an invalid transaction_id
        const result = await retrieveDeferredCredential(
            app,
            issuerMetadata,
            accessTokenResponse.access_token,
            "invalid-transaction-id",
        );
        expect(result.statusCode).toBe(400);
        expect(result.body.error).toBe("invalid_transaction_id");
    });

    test("deferred credential - transaction already retrieved", async () => {
        const pollingInterval = 2;

        // Mock the webhook server to return a deferred response
        nock("http://localhost:8787")
            .post("/deferred-retrieved", () => true)
            .reply(200, {
                deferred: true,
                interval: pollingInterval,
            });

        const offerResponse = await request(app.getHttpServer())
            .post("/issuer/offer")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                flow: "pre_authorized_code",
                response_type: "uri",
                credentialConfigurationIds: ["citizen"],
                credentialClaims: {
                    citizen: {
                        type: "webhook",
                        webhook: {
                            url: "http://localhost:8787/deferred-retrieved",
                            auth: { type: "none" },
                        },
                    },
                },
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

        const { accessTokenResponse } =
            await client.retrievePreAuthorizedCodeAccessTokenFromOffer({
                credentialOffer,
                issuerMetadata,
            });

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

        // Request credential - should get deferred response
        const credentialResponse = await client.retrieveCredentials({
            accessToken: accessTokenResponse.access_token,
            credentialConfigurationId:
                credentialOffer.credential_configuration_ids[0],
            issuerMetadata,
            proofs: {
                jwt: [proofJwt],
            },
        });

        const transactionId =
            credentialResponse.credentialResponse.transaction_id!;

        // Complete the deferred transaction
        await request(app.getHttpServer())
            .post(`/issuer/deferred/${transactionId}/complete`)
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                claims: { town: "Munich" },
            })
            .expect(200);

        // First retrieval should succeed
        const firstRetrieval = await retrieveDeferredCredential(
            app,
            issuerMetadata,
            accessTokenResponse.access_token,
            transactionId,
        );
        expect(firstRetrieval.statusCode).toBe(200);
        expect(firstRetrieval.body.credential).toBeDefined();

        // Second retrieval should fail with invalid_transaction_id (already retrieved)
        const secondRetrieval = await retrieveDeferredCredential(
            app,
            issuerMetadata,
            accessTokenResponse.access_token,
            transactionId,
        );
        expect(secondRetrieval.statusCode).toBe(400);
        expect(secondRetrieval.body.error).toBe("invalid_transaction_id");
    });

    test("deferred credential - failed transaction", async () => {
        // Mock the webhook server to return a deferred response
        nock("http://localhost:8787")
            .post("/deferred-fail", () => true)
            .reply(200, {
                deferred: true,
                interval: 2,
            });

        const offerResponse = await request(app.getHttpServer())
            .post("/issuer/offer")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                flow: "pre_authorized_code",
                response_type: "uri",
                credentialConfigurationIds: ["citizen"],
                credentialClaims: {
                    citizen: {
                        type: "webhook",
                        webhook: {
                            url: "http://localhost:8787/deferred-fail",
                            auth: { type: "none" },
                        },
                    },
                },
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

        const { accessTokenResponse } =
            await client.retrievePreAuthorizedCodeAccessTokenFromOffer({
                credentialOffer,
                issuerMetadata,
            });

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

        // Request credential - should get deferred response
        const credentialResponse = await client.retrieveCredentials({
            accessToken: accessTokenResponse.access_token,
            credentialConfigurationId:
                credentialOffer.credential_configuration_ids[0],
            issuerMetadata,
            proofs: {
                jwt: [proofJwt],
            },
        });

        const transactionId =
            credentialResponse.credentialResponse.transaction_id!;

        // Fail the deferred transaction
        const errorMessage = "KYC verification failed";
        await request(app.getHttpServer())
            .post(`/issuer/deferred/${transactionId}/fail`)
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                error: errorMessage,
            })
            .expect(200);

        // Poll should return invalid_transaction_id with error message
        const result = await retrieveDeferredCredential(
            app,
            issuerMetadata,
            accessTokenResponse.access_token,
            transactionId,
        );
        expect(result.statusCode).toBe(400);
        expect(result.body.error).toBe("invalid_transaction_id");
    });
});
