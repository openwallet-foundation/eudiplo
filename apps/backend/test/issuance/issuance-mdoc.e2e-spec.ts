import { INestApplication } from "@nestjs/common";
import {
    clientAuthenticationAnonymous,
    Jwk,
    JwtSignerJwk,
} from "@openid4vc/oauth2";
import { Openid4vciClient } from "@openid4vc/openid4vci";
import { exportJWK, generateKeyPair } from "jose";
import { Issuer } from "@owf/mdoc";
import request from "supertest";
import { App } from "supertest/types";
import { Agent, setGlobalDispatcher } from "undici";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
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

describe("Issuance - mDOC Credentials", () => {
    let app: INestApplication<App>;
    let authToken: string;
    let clientId: string;
    let ctx: IssuanceTestContext;

    beforeAll(async () => {
        ctx = await setupIssuanceTestApp();
        app = ctx.app;
        authToken = ctx.authToken;
        clientId = ctx.clientId;
    });

    afterAll(async () => {
        await app.close();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("issue mso_mdoc credential", async () => {
        const addNamespaceSpy = vi.spyOn(Issuer.prototype as any, "addIssuerNamespace");

        // Create an offer for mDOC credential
        const offerResponse = await request(app.getHttpServer())
            .post("/issuer/offer")
            .trustLocalhost()
            .set("Authorization", `Bearer ${authToken}`)
            .send({
                response_type: "uri",
                credentialConfigurationIds: ["pid-mdoc-no-key"],
                flow: "pre_authorized_code",
            })
            .expect(201);

        expect(offerResponse.body.uri).toBeDefined();

        // Generate holder key pair
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

        // Resolve credential offer
        const credentialOffer = await client.resolveCredentialOffer(
            offerResponse.body.uri,
        );

        // Resolve issuer metadata
        const issuerMetadata = await client.resolveIssuerMetadata(
            credentialOffer.credential_issuer,
        );

        // Get access token using pre-authorized code
        const { accessTokenResponse } =
            await client.retrievePreAuthorizedCodeAccessTokenFromOffer({
                credentialOffer,
                issuerMetadata,
            });

        // Request nonce from the nonce endpoint (OID4VCI spec)
        const nonceResponse = await client.requestNonce({ issuerMetadata });
        expect(nonceResponse.c_nonce).toBeDefined();

        //TODO: check if jwt or cose has to be
        // Create JWT proof for credential request
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

        // Retrieve the mDOC credential
        const credentialResponse = await client
            .retrieveCredentials({
                accessToken: accessTokenResponse.access_token,
                credentialConfigurationId:
                    credentialOffer.credential_configuration_ids[0],
                issuerMetadata,
                proofs: {
                    jwt: [proofJwt],
                },
            })
            .catch((error) => {
                console.error("Error retrieving credentials:", error);
                throw error;
            });

        const credential: string = (
            credentialResponse.credentialResponse.credentials?.[0] as any
        ).credential;
        expect(credential).toBeDefined();    

        // mDOC credential should be a base64url encoded string
        expect(typeof credential).toBe("string");
        // Verify it's valid base64url (no padding, no + or /)
        expect(credential).toMatch(/^[A-Za-z0-9_-]+$/);

        expect(addNamespaceSpy).toHaveBeenCalledTimes(1);
        expect(addNamespaceSpy).toHaveBeenCalledWith(
            "eu.europa.ec.eudi.pid.1",
            expect.objectContaining({
                age_birth_year: 1964,
                age_over_18: true,
                birth_date: "1964-08-12",
            }),
        );
    });
});
