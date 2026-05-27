/**
 * oid4vp-presentation scenario — OID4VP presentation request creation and retrieval.
 *
 * Each VU iteration exercises the verifier-side flow up to (but NOT including)
 * the wallet's VP token submission, because a full VP response requires a real
 * wallet with an issued credential (a Holder-bound SD-JWT VC).  The parts
 * tested here cover the majority of the latency-sensitive code paths:
 *
 *   1. Obtain admin Bearer token (POST /api/oauth2/token)
 *   2. Create a presentation session (POST /verifier/offer)
 *   3. Fetch the authorization request object (GET /presentations/:sessionId/oid4vp/request)
 *
 * To extend this test with a full VP submission, provide a real credential
 * via the CREDENTIAL_JWT environment variable and implement the VP signing
 * step before calling the response endpoint.
 *
 * Environment variables:
 *   BASE_URL        - Backend base URL (default: http://localhost:3000)
 *   CLIENT_ID       - OAuth2 client ID (default: test-client)
 *   CLIENT_SECRET   - OAuth2 client secret (default: test-client-secret)
 *   REQUEST_ID      - Verifier request config ID (default: age-over-18)
 *   K6_PROFILE      - Load profile: smoke | load | stress | spike (default: smoke)
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import type { Options } from 'k6/options';
import {
    getAdminToken,
    assertStatus,
    authParams,
    parseQueryString,
} from '../lib/helpers.ts';
import { profileOptions } from '../k6.config.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CLIENT_ID = __ENV.CLIENT_ID || 'presentation-test';
const CLIENT_SECRET = __ENV.CLIENT_SECRET || 'presentation-test-secret';
const REQUEST_ID = __ENV.REQUEST_ID || 'age-over-18';

const VERIFIER_OFFER_ENDPOINT = `${BASE_URL}/api/verifier/offer`;

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------

export const options: Options = {
    ...profileOptions(),
    thresholds: {
        'http_req_duration{stage:offer}': ['p(95)<1000'],
        'http_req_duration{stage:request_object}': ['p(95)<500'],
        http_req_failed: ['rate<0.01'],
        presentation_session_created: ['count>0'],
    },
};

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

const sessionCreated = new Counter('presentation_session_created');
const requestObjectFetched = new Counter('presentation_request_object_fetched');
const presentationDuration = new Trend('presentation_total_duration', true);

// ---------------------------------------------------------------------------
// Default VU function
// ---------------------------------------------------------------------------

export default function (): void {
    const iterStart = Date.now();

    // -----------------------------------------------------------------------
    // Step 1: Admin token
    // -----------------------------------------------------------------------
    let adminToken!: string;
    group('admin_auth', () => {
        adminToken = getAdminToken(BASE_URL, CLIENT_ID, CLIENT_SECRET);
    });

    // -----------------------------------------------------------------------
    // Step 2: Create presentation session
    // -----------------------------------------------------------------------
    let sessionId!: string;
    let requestUri!: string;
    group('create_presentation_offer', () => {
        const body = {
            response_type: 'uri',
            requestId: REQUEST_ID,
        };

        const res = http.post(VERIFIER_OFFER_ENDPOINT, JSON.stringify(body), {
            ...authParams(adminToken),
            tags: { stage: 'offer' },
        });

        assertStatus(res, 201, 'create presentation offer');

        const offer = res.json() as { session: string; uri: string };
        sessionId = offer.session;
        requestUri = offer.uri; // openid4vp://?request_uri=...

        check(offer, {
            'session ID present': (o) => typeof o.session === 'string' && o.session.length > 0,
            'offer URI present': (o) => typeof o.uri === 'string' && o.uri.startsWith('openid4vp://'),
        });

        sessionCreated.add(1);
    });

    // -----------------------------------------------------------------------
    // Step 3: Fetch the authorization request object (wallet perspective)
    // The wallet would normally follow the request_uri from the offer.
    // -----------------------------------------------------------------------
    group('fetch_request_object', () => {
        // The request_uri from the offer points to the backend's request endpoint.
        // Parse it to get the direct backend URL if needed.
        const params = parseQueryString(requestUri);
        const backendRequestUrl = params.request_uri
            ? params.request_uri
            : `${BASE_URL}/presentations/${sessionId}/oid4vp/request`;

        const res = http.get(backendRequestUrl, {
            headers: { Accept: 'application/oauth-authz-req+jwt, application/json' },
            tags: { stage: 'request_object' },
        });

        const ok = check(res, {
            'request object: status 200': (r) => r.status === 200,
            'request object: non-empty body': (r) => !!r.body && r.body.length > 0,
        });

        if (ok) {
            requestObjectFetched.add(1);
        }
    });

    presentationDuration.add(Date.now() - iterStart);
}
