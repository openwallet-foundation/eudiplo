/**
 * pre-auth-issuance scenario — Full OID4VCI pre-authorized_code credential issuance flow.
 *
 * Each VU iteration exercises the complete wallet-side issuance path:
 *
 *   1. Obtain admin Bearer token (POST /api/oauth2/token)
 *   2. Create a credential offer (POST /issuer/offer)
 *   3. Resolve the credential offer URI → extract pre-authorized_code
 *   4. Exchange pre-authorized_code for a wallet access token
 *      (POST /issuers/:tenantId/authorize/token)
 *   5. Fetch a fresh c_nonce (POST /issuers/:tenantId/vci/nonce)
 *   6. Sign an OID4VCI key-binding proof JWT (ECDSA P-256)
 *   7. Request the credential (POST /issuers/:tenantId/vci/credential)
 *
 * Environment variables:
 *   BASE_URL      - Backend base URL (default: http://localhost:3000)
 *   TENANT_ID     - Issuer tenant ID (default: demo)
 *   CLIENT_ID     - OAuth2 client ID (default: test-client)
 *   CLIENT_SECRET - OAuth2 client secret (default: test-client-secret)
 *   K6_PROFILE    - Load profile: smoke | load | stress | spike (default: smoke)
 *
 * Requirements:
 *   k6 >= 2.0.0   (global WebCrypto API)
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import type { Options } from 'k6/options';
import {
    getAdminToken,
    formEncode,
    resolveCredentialOffer,
    extractPreAuthCode,
    assertStatus,
    authParams,
} from '../lib/helpers.ts';
import {
    generateKeyPair,
    exportKeyPair,
    importPrivateKey,
    signProofJwt,
} from '../lib/crypto.ts';
import { profileOptions } from '../k6.config.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TENANT_ID = __ENV.TENANT_ID || 'demo';
const CLIENT_ID = __ENV.CLIENT_ID || 'test-client';
const CLIENT_SECRET = __ENV.CLIENT_SECRET || 'test-client-secret';
const CREDENTIAL_CONFIG_ID = __ENV.CREDENTIAL_CONFIG_ID || 'pid';

const ISSUER_BASE = `${BASE_URL}/issuers/${TENANT_ID}`;
const TOKEN_ENDPOINT = `${ISSUER_BASE}/authorize/token`;
const NONCE_ENDPOINT = `${ISSUER_BASE}/vci/nonce`;
const CREDENTIAL_ENDPOINT = `${ISSUER_BASE}/vci/credential`;
const OFFER_ENDPOINT = `${BASE_URL}/issuer/offer`;

/** Inline PID claims used for each issuance. Default values match the pid.json config. */
const INLINE_CLAIMS = {
    [CREDENTIAL_CONFIG_ID]: {
        type: 'inline',
        claims: {
            given_name: 'Load',
            family_name: 'Test',
            birthdate: '1990-01-01',
            address: {
                street_address: 'HEIDESTRAẞE 17',
                locality: 'KÖLN',
                country: 'DE',
                postal_code: '51147',
            },
        },
    },
};

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------

export const options: Options = {
    ...profileOptions(),
    thresholds: {
        // Credential issuance is crypto-heavy; allow up to 3 s at p(95).
        'http_req_duration{stage:credential}': ['p(95)<3000'],
        'http_req_duration{stage:offer}': ['p(95)<1000'],
        'http_req_duration{stage:token_exchange}': ['p(95)<1000'],
        http_req_failed: ['rate<0.01'],
        issuance_success: ['count>0'],
    },
};

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

const issuanceSuccess = new Counter('issuance_success');
const issuanceDuration = new Trend('issuance_total_duration', true);

// ---------------------------------------------------------------------------
// Setup data type
// ---------------------------------------------------------------------------

interface SetupData {
    privateJwk: JsonWebKey;
    publicJwk: JsonWebKey;
}

// ---------------------------------------------------------------------------
// Setup — runs once before all VUs start
// ---------------------------------------------------------------------------

export async function setup(): Promise<SetupData> {
    // Generate an EC P-256 key pair.  CryptoKey objects cannot be serialised
    // across the setup→VU boundary, so we export them as JWKs and re-import
    // inside the default function.
    const keyPair = await generateKeyPair();
    const { privateJwk, publicJwk } = await exportKeyPair(keyPair);

    return { privateJwk, publicJwk };
}

// ---------------------------------------------------------------------------
// Default VU function
// ---------------------------------------------------------------------------

export default async function (data: SetupData): Promise<void> {
    const { privateJwk, publicJwk } = data;
    const iterStart = Date.now();

    // -----------------------------------------------------------------------
    // Step 1: Admin token (operator / backend system perspective)
    // -----------------------------------------------------------------------
    let adminToken!: string;
    group('admin_auth', () => {
        adminToken = getAdminToken(BASE_URL, CLIENT_ID, CLIENT_SECRET);
    });

    // -----------------------------------------------------------------------
    // Step 2: Create credential offer
    // -----------------------------------------------------------------------
    let offerUri!: string;
    let credentialIssuer!: string;
    group('create_offer', () => {
        const body = {
            response_type: 'uri',
            credentialConfigurationIds: [CREDENTIAL_CONFIG_ID],
            flow: 'pre_authorized_code',
            credentialClaims: INLINE_CLAIMS,
        };

        const res = http.post(OFFER_ENDPOINT, JSON.stringify(body), {
            ...authParams(adminToken),
            tags: { stage: 'offer' },
        });

        assertStatus(res, 201, 'create offer');

        const offer = res.json() as { uri: string };
        offerUri = offer.uri;
        // The credential_issuer embedded in the offer equals the issuer URL used
        // as 'aud' in the proof JWT.
        credentialIssuer = `${BASE_URL}/issuers/${TENANT_ID}`;
    });

    // -----------------------------------------------------------------------
    // Step 3: Resolve offer and extract pre-authorized_code
    // -----------------------------------------------------------------------
    let preAuthCode!: string;
    group('resolve_offer', () => {
        const credentialOffer = resolveCredentialOffer(offerUri);
        preAuthCode = extractPreAuthCode(credentialOffer);
    });

    // -----------------------------------------------------------------------
    // Step 4: Exchange pre-authorized_code for wallet access token
    // -----------------------------------------------------------------------
    let walletAccessToken!: string;
    group('token_exchange', () => {
        const body = formEncode({
            grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
            'pre-authorized_code': preAuthCode,
        });

        const res = http.post(TOKEN_ENDPOINT, body, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            tags: { stage: 'token_exchange' },
        });

        assertStatus(res, 200, 'token exchange');
        walletAccessToken = res.json('access_token') as string;
    });

    // -----------------------------------------------------------------------
    // Step 5: Fetch c_nonce
    // -----------------------------------------------------------------------
    let cNonce!: string;
    group('nonce', () => {
        const res = http.post(
            NONCE_ENDPOINT,
            null,
            {
                headers: { 'Content-Type': 'application/json' },
                tags: { stage: 'nonce' },
            },
        );

        assertStatus(res, 200, 'nonce endpoint');
        cNonce = res.json('c_nonce') as string;

        check(cNonce, { 'c_nonce is non-empty string': (v) => typeof v === 'string' && v.length > 0 });
    });

    // -----------------------------------------------------------------------
    // Step 6 + 7: Sign proof JWT and request credential
    // -----------------------------------------------------------------------
    await group('credential', async () => {
        // Import the shared private key JWK for this iteration's signing.
        const privateKey = await importPrivateKey(privateJwk);
        const proofJwt = await signProofJwt(privateKey, publicJwk, cNonce, credentialIssuer);

        const body = {
            credential_identifier: CREDENTIAL_CONFIG_ID,
            proofs: {
                jwt: [proofJwt],
            },
        };

        const res = http.post(CREDENTIAL_ENDPOINT, JSON.stringify(body), {
            headers: {
                Authorization: `Bearer ${walletAccessToken}`,
                'Content-Type': 'application/json',
            },
            tags: { stage: 'credential' },
        });

        const ok = check(res, {
            'credential: status 200': (r) => r.status === 200,
            'credential: credentials array present': (r) => {
                try {
                    const body = r.json() as Record<string, unknown>;
                    // Response is either { credential } or { credentials: [...] }
                    return (
                        (typeof body.credential === 'string' && body.credential.length > 0) ||
                        (Array.isArray(body.credentials) && body.credentials.length > 0)
                    );
                } catch {
                    return false;
                }
            },
        });

        if (ok) {
            issuanceSuccess.add(1);
        }
    });

    issuanceDuration.add(Date.now() - iterStart);
}
