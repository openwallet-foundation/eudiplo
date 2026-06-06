/**
 * status-list scenario — Bitstring Status List read performance.
 *
 * Each VU iteration:
 *   1. Fetches the status list aggregation endpoint to discover available
 *      status list URIs (GET /issuers/:tenantId/status-management/status-list-aggregation)
 *   2. Fetches each discovered status list JWT (up to MAX_LISTS per iteration)
 *
 * Note: This scenario requires that at least one credential with statusManagement
 * enabled has been issued previously so that status lists exist.  If no lists
 * are found, the scenario logs a warning and skips step 2.
 *
 * Environment variables:
 *   BASE_URL    - Backend base URL (default: http://localhost:3000)
 *   TENANT_ID   - Issuer tenant ID (default: demo)
 *   MAX_LISTS   - Max status lists to fetch per iteration (default: 5)
 *   K6_PROFILE  - Load profile: smoke | load | stress | spike (default: smoke)
 */

import http from 'k6/http';
import { check, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import type { Options } from 'k6/options';
import { assertStatus } from '../lib/helpers.ts';
import { profileOptions } from '../k6.config.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TENANT_ID = __ENV.TENANT_ID || 'demo';
const MAX_LISTS = parseInt(__ENV.MAX_LISTS || '5', 10);

const AGGREGATION_ENDPOINT =
    `${BASE_URL}/issuers/${TENANT_ID}/status-management/status-list-aggregation`;

// ---------------------------------------------------------------------------
// k6 options
// ---------------------------------------------------------------------------

export const options: Options = {
    ...profileOptions(),
    thresholds: {
        // Status lists are cached JWT documents — should be very fast.
        'http_req_duration{stage:aggregation}': ['p(95)<300'],
        'http_req_duration{stage:status_list}': ['p(95)<500'],
        http_req_failed: ['rate<0.01'],
    },
};

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

const aggregationFetched = new Counter('status_list_aggregation_fetched');
const statusListFetched = new Counter('status_list_fetched');
const statusListDuration = new Trend('status_list_fetch_duration', true);

// ---------------------------------------------------------------------------
// Default VU function
// ---------------------------------------------------------------------------

export default function (): void {
    // -----------------------------------------------------------------------
    // Step 1: Fetch status list aggregation
    // -----------------------------------------------------------------------
    let statusListUris: string[] = [];

    group('status_list_aggregation', () => {
        const res = http.get(AGGREGATION_ENDPOINT, {
            headers: { Accept: 'application/json' },
            tags: { stage: 'aggregation' },
        });

        assertStatus(res, 200, 'status list aggregation');
        aggregationFetched.add(1);

        let body: unknown;
        try {
            body = res.json();
        } catch {
            // Non-JSON body — treat as empty list
            return;
        }

        // The aggregation endpoint returns { status_lists: string[] }
        // (StatusListAggregationDto).  Guard against alternative shapes just in case.
        const b = body as Record<string, unknown>;
        if (Array.isArray(b.status_lists)) {
            statusListUris = (b.status_lists as string[]).slice(0, MAX_LISTS);
        } else if (Array.isArray(body)) {
            statusListUris = (body as string[]).slice(0, MAX_LISTS);
        } else if (Array.isArray(b.statusLists)) {
            statusListUris = (b.statusLists as string[]).slice(0, MAX_LISTS);
        } else if (Array.isArray(b.uris)) {
            statusListUris = (b.uris as string[]).slice(0, MAX_LISTS);
        }
    });

    if (statusListUris.length === 0) {
        // No status lists exist yet — issue at least one credential first.
        check(null, {
            'WARN: no status lists found (issue a credential first)': () => false,
        });
        return;
    }

    // -----------------------------------------------------------------------
    // Step 2: Fetch each status list JWT
    // -----------------------------------------------------------------------
    group('fetch_status_lists', () => {
        for (const uri of statusListUris) {
            const start = Date.now();

            const res = http.get(uri, {
                headers: { Accept: 'application/statuslist+jwt, application/jwt' },
                tags: { stage: 'status_list' },
            });

            statusListDuration.add(Date.now() - start);

            const ok = check(res, {
                'status list: status 200': (r) => r.status === 200,
                'status list: JWT content-type': (r) => {
                    const ct = r.headers['Content-Type'] || '';
                    return (
                        ct.includes('statuslist+jwt') ||
                        ct.includes('application/jwt')
                    );
                },
                'status list: non-empty body': (r) => !!r.body && r.body.length > 0,
            });

            if (ok) {
                statusListFetched.add(1);
            }
        }
    });
}
