/**
 * Shared HTTP helper utilities for EUDIPLO k6 load tests.
 */

import http from 'k6/http';
import { check, fail } from 'k6';
import type { Params, RefinedResponse, ResponseType } from 'k6/http';

/** Credential offer shape returned by the resolve step. */
export interface CredentialOffer {
    credential_issuer?: string;
    credential_configuration_ids?: string[];
    grants?: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code'?: {
            'pre-authorized_code'?: string;
        };
    };
}

/**
 * Obtain an OAuth2 Bearer token using the client credentials flow.
 */
export function getAdminToken(
    baseUrl: string,
    clientId: string,
    clientSecret: string,
): string {
    const res = http.post(
        `${baseUrl}/api/oauth2/token`,
        JSON.stringify({
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
        }),
        { headers: { 'Content-Type': 'application/json' } },
    );

    const ok = check(res, { 'admin token: status 201': (r) => r.status === 201 });
    if (!ok) {
        fail(`Failed to obtain admin token: ${res.status} ${res.body}`);
    }

    return res.json('access_token') as string;
}

/**
 * Build a URL-encoded form body string from a plain object.
 */
export function formEncode(params: Record<string, string>): string {
    return Object.entries(params)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
}

/**
 * Parse the query string portion of a URL into a plain object.
 * Works with any scheme (including openid-credential-offer://).
 */
export function parseQueryString(uri: string): Record<string, string> {
    const qsStart = uri.indexOf('?');
    if (qsStart < 0) return {};
    const qs = uri.slice(qsStart + 1);
    const result: Record<string, string> = {};
    for (const pair of qs.split('&')) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx < 0) continue;
        const key = decodeURIComponent(pair.slice(0, eqIdx));
        const val = decodeURIComponent(pair.slice(eqIdx + 1).replace(/\+/g, ' '));
        result[key] = val;
    }
    return result;
}

/**
 * Resolve a credential offer URI into the parsed credential offer object.
 * Handles both inline (?credential_offer=) and by-reference (?credential_offer_uri=) forms.
 */
export function resolveCredentialOffer(offerUri: string): CredentialOffer {
    const params = parseQueryString(offerUri);

    if (params.credential_offer) {
        return JSON.parse(params.credential_offer) as CredentialOffer;
    }

    if (params.credential_offer_uri) {
        const res = http.get(params.credential_offer_uri, {
            headers: { Accept: 'application/json' },
        });
        const ok = check(res, {
            'credential offer fetch: status 200': (r) => r.status === 200,
        });
        if (!ok) {
            fail(`Failed to fetch credential offer: ${res.status} ${res.body}`);
        }
        return res.json() as CredentialOffer;
    }

    fail(`Unrecognised credential offer URI format: ${offerUri}`);
    // fail() throws, but TypeScript doesn't know that
    return {} as CredentialOffer;
}

/**
 * Extract the pre-authorized_code from a resolved credential offer.
 */
export function extractPreAuthCode(credentialOffer: CredentialOffer): string {
    const grants = credentialOffer.grants ?? {};
    const preAuthGrant =
        grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'];
    if (!preAuthGrant || !preAuthGrant['pre-authorized_code']) {
        fail('Credential offer does not contain a pre-authorized_code grant');
    }
    return preAuthGrant!['pre-authorized_code'] as string;
}

/**
 * Assert that an HTTP response has the expected status code and fail the iteration
 * with a helpful message if not.
 */
export function assertStatus(
    res: RefinedResponse<ResponseType | undefined>,
    expectedStatus: number,
    label: string,
): void {
    const ok = check(res, {
        [`${label}: status ${expectedStatus}`]: (r) => r.status === expectedStatus,
    });
    if (!ok) {
        fail(`${label}: unexpected status ${res.status}. Body: ${res.body}`);
    }
}

/**
 * Build the set of standard request params for the EUDIPLO backend.
 */
export function authParams(token: string): Params {
    return {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };
}
