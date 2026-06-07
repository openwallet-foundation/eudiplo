/**
 * api-auth scenario — OAuth2 client credentials token endpoint baseline.
 *
 * Exercises: POST /api/oauth2/token
 *
 * This is the simplest scenario and establishes a latency / throughput
 * baseline for the authentication layer before running the more complex
 * protocol flows.
 *
 * Environment variables:
 *   BASE_URL      - Backend base URL (default: http://localhost:3000)
 *   CLIENT_ID     - OAuth2 client ID (default: test-client)
 *   CLIENT_SECRET - OAuth2 client secret (default: test-client-secret)
 *   K6_PROFILE    - Load profile: smoke | load | stress | spike (default: smoke)
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import type { Options } from 'k6/options';
import { profileOptions } from '../k6.config.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CLIENT_ID = __ENV.CLIENT_ID || 'test-client';
const CLIENT_SECRET = __ENV.CLIENT_SECRET || 'test-client-secret';

const TOKEN_ENDPOINT = `${BASE_URL}/api/oauth2/token`;

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------

export const options: Options = {
    ...profileOptions(),
    thresholds: {
        // Token endpoint should be fast — tighten to 500 ms p(95).
        'http_req_duration{endpoint:token}': ['p(95)<500'],
        http_req_failed: ['rate<0.01'],
    },
};

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

const tokenSuccess = new Counter('auth_token_success');
const tokenDuration = new Trend('auth_token_duration', true);

// ---------------------------------------------------------------------------
// Default VU function
// ---------------------------------------------------------------------------

export default function (): void {
    group('client_credentials_flow', () => {
        const start = Date.now();

        const res = http.post(
            TOKEN_ENDPOINT,
            JSON.stringify({
                grant_type: 'client_credentials',
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
            }),
            {
                headers: { 'Content-Type': 'application/json' },
                tags: { endpoint: 'token' },
            },
        );

        tokenDuration.add(Date.now() - start);

        const ok = check(res, {
            'status is 200': (r) => r.status === 200,
            'access_token present': (r) => {
                try {
                    return !!r.json('access_token');
                } catch {
                    return false;
                }
            },
            'token_type is Bearer': (r) => {
                try {
                    return r.json('token_type') === 'Bearer';
                } catch {
                    return false;
                }
            },
        });

        if (ok) {
            tokenSuccess.add(1);
        }
    });
}
