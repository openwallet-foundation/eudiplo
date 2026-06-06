/**
 * Shared k6 options/profiles for EUDIPLO load tests.
 *
 * Usage in a scenario:
 *
 *   import { loadOptions } from '../k6.config';
 *   export const options = loadOptions;
 */

import type { Options } from 'k6/options';

/** Common SLO thresholds applied to every scenario. */
export const commonThresholds: Record<string, string[]> = {
    /**
     * 95th-percentile response time must be below 2 s.
     * Adjust per scenario if needed (e.g. credential issuance can be slower).
     */
    http_req_duration: ['p(95)<2000'],
    /** Error rate must stay below 1 %. */
    http_req_failed: ['rate<0.01'],
};

/**
 * Smoke test — minimal load to verify the scenario is working.
 * 2 VUs for 1 minute.
 */
export const smokeOptions: Options = {
    thresholds: commonThresholds,
    stages: [
        { duration: '30s', target: 2 },
        { duration: '30s', target: 2 },
        { duration: '15s', target: 0 },
    ],
};

/**
 * Average load test — simulates typical production traffic.
 * Ramp up to 50 VUs over 2 min, hold for 5 min, ramp down.
 */
export const loadOptions: Options = {
    thresholds: commonThresholds,
    stages: [
        { duration: '2m', target: 50 },
        { duration: '5m', target: 50 },
        { duration: '1m', target: 0 },
    ],
};

/**
 * Stress test — pushes beyond expected peak to find the breaking point.
 * Ramps up aggressively to 200 VUs.
 */
export const stressOptions: Options = {
    thresholds: {
        // Relax thresholds slightly for stress testing.
        http_req_duration: ['p(95)<5000'],
        http_req_failed: ['rate<0.05'],
    },
    stages: [
        { duration: '2m', target: 50 },
        { duration: '3m', target: 100 },
        { duration: '3m', target: 200 },
        { duration: '2m', target: 200 },
        { duration: '2m', target: 0 },
    ],
};

/**
 * Spike test — sudden traffic surge to verify autoscaling / circuit breakers.
 */
export const spikeOptions: Options = {
    thresholds: {
        http_req_duration: ['p(95)<5000'],
        http_req_failed: ['rate<0.10'],
    },
    stages: [
        { duration: '30s', target: 5 },
        { duration: '10s', target: 300 }, // spike
        { duration: '1m', target: 300 },
        { duration: '10s', target: 5 },  // recover
        { duration: '30s', target: 0 },
    ],
};

/**
 * Return the options object for the profile specified by the K6_PROFILE env var.
 * Defaults to 'smoke'.
 */
export function profileOptions(): Options {
    const profile = (__ENV.K6_PROFILE || 'smoke').toLowerCase();
    const map: Record<string, Options> = {
        smoke: smokeOptions,
        load: loadOptions,
        stress: stressOptions,
        spike: spikeOptions,
    };
    if (!map[profile]) {
        throw new Error(`Unknown K6_PROFILE "${profile}". Choose: smoke, load, stress, spike`);
    }
    return map[profile];
}
