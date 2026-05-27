#!/usr/bin/env bash
# =============================================================================
# EUDIPLO k6 Load Test Runner
# =============================================================================
#
# Runs one or more k6 load test scenarios against an EUDIPLO backend.
#
# Usage:
#   ./run-all.sh [scenario...]
#
#   If no scenario is specified all scenarios are run in sequence.
#   Available scenarios: api-auth, pre-auth-issuance, oid4vp-presentation, status-list
#
# Environment variables:
#   BASE_URL            Backend base URL          (default: http://localhost:3000)
#   TENANT_ID           Issuer / verifier tenant  (default: demo)
#   CLIENT_ID           OAuth2 client ID          (default: test-client)
#   CLIENT_SECRET       OAuth2 client secret      (default: test-client-secret)
#   START_STACK         Auto-start compose stack  (default: true)
#   COMPOSE_PROFILE     Compose profile to start   (default: standard)
#   K6_ENV_FILE         Compose env file path      (default:
#                         deployment/docker-compose/.env)
#   K6_PROFILE          Load profile              (default: smoke)
#                         smoke | load | stress | spike
#   PROMETHEUS_RW_URL   If set, metrics are pushed to this Prometheus remote-
#                         write endpoint in addition to stdout.
#                         Example: http://localhost:9090/api/v1/write
#   SUMMARY_DIR         Directory for JSON summaries (default: ./results)
#   PAUSE_BETWEEN       Seconds to pause between scenarios (default: 5)
#
# Examples:
#   # Smoke test all scenarios
#   ./run-all.sh
#
#   # Load test pre-auth issuance only
#   K6_PROFILE=load ./run-all.sh pre-auth-issuance
#
#   # Stress test with Prometheus output
#   K6_PROFILE=stress PROMETHEUS_RW_URL=http://localhost:9090/api/v1/write \
#     ./run-all.sh pre-auth-issuance oid4vp-presentation
#
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve script directory so the script works regardless of where it is
# called from.
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCENARIOS_DIR="${SCRIPT_DIR}/scenarios"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_DIR="${REPO_ROOT}/deployment/docker-compose"

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
BASE_URL="${BASE_URL:-http://localhost:3000}"
TENANT_ID="${TENANT_ID:-demo}"
CLIENT_ID="${CLIENT_ID:-test-client}"
CLIENT_SECRET="${CLIENT_SECRET:-test-client-secret}"
START_STACK="${START_STACK:-true}"
COMPOSE_PROFILE="${COMPOSE_PROFILE:-standard}"
K6_ENV_FILE="${K6_ENV_FILE:-${COMPOSE_DIR}/.env}"
K6_PROFILE="${K6_PROFILE:-smoke}"
SUMMARY_DIR="${SUMMARY_DIR:-${SCRIPT_DIR}/results}"
PAUSE_BETWEEN="${PAUSE_BETWEEN:-5}"

ALL_SCENARIOS=(api-auth pre-auth-issuance oid4vp-presentation status-list)

# ---------------------------------------------------------------------------
# Determine which scenarios to run
# ---------------------------------------------------------------------------
if [[ $# -gt 0 ]]; then
    RUN_SCENARIOS=("$@")
else
    RUN_SCENARIOS=("${ALL_SCENARIOS[@]}")
fi

# ---------------------------------------------------------------------------
# Validate scenario names
# ---------------------------------------------------------------------------
for scenario in "${RUN_SCENARIOS[@]}"; do
    script="${SCENARIOS_DIR}/${scenario}.ts"
    if [[ ! -f "${script}" ]]; then
        echo "ERROR: Unknown scenario '${scenario}'. Available: ${ALL_SCENARIOS[*]}" >&2
        exit 1
    fi
done

# ---------------------------------------------------------------------------
# Check k6 is installed
# ---------------------------------------------------------------------------
if ! command -v k6 &>/dev/null; then
    echo "ERROR: k6 is not installed or not in PATH." >&2
    echo "  Install: https://k6.io/docs/get-started/installation/" >&2
    exit 1
fi

wait_for_backend() {
    local retries=60
    local interval=2
    local health_url="${BASE_URL%/}/health"

    echo "Waiting for backend health at ${health_url}..."
    for ((i=1; i<=retries; i++)); do
        if curl -sf "${health_url}" >/dev/null 2>&1; then
            echo "Backend is healthy."
            return 0
        fi
        sleep "${interval}"
    done

    echo "ERROR: Backend did not become healthy in $((retries * interval))s" >&2
    return 1
}

start_stack_if_requested() {
    if [[ "${START_STACK}" != "true" ]]; then
        return 0
    fi

    if ! command -v docker &>/dev/null; then
        echo "ERROR: docker is required when START_STACK=true" >&2
        return 1
    fi

    if [[ ! -f "${K6_ENV_FILE}" ]]; then
        echo "ERROR: K6 env file not found: ${K6_ENV_FILE}" >&2
        return 1
    fi

    # If the backend is already healthy, reuse the running stack as-is.
    local health_url="${BASE_URL%/}/health"
    if curl -sf "${health_url}" >/dev/null 2>&1; then
        echo "Backend already healthy at ${health_url}, reusing existing stack."
        return 0
    fi

    echo "Starting compose stack (${COMPOSE_PROFILE}) using ${K6_ENV_FILE}"
    (
        cd "${COMPOSE_DIR}"
        docker compose --env-file "${K6_ENV_FILE}" --profile "${COMPOSE_PROFILE}" up -d
    )

    wait_for_backend
}

start_stack_if_requested

# ---------------------------------------------------------------------------
# Create results directory
# ---------------------------------------------------------------------------
mkdir -p "${SUMMARY_DIR}"

# ---------------------------------------------------------------------------
# Run scenarios
# ---------------------------------------------------------------------------
FAILED_SCENARIOS=()
TIMESTAMP="$(date +%Y%m%dT%H%M%S)"

run_scenario() {
    local scenario="$1"
    local script="${SCENARIOS_DIR}/${scenario}.ts"
    local summary_file="${SUMMARY_DIR}/${TIMESTAMP}-${scenario}.json"
    local log_file="${SUMMARY_DIR}/${TIMESTAMP}-${scenario}.log"

    echo ""
    echo "============================================================"
    echo "  Scenario : ${scenario}"
    echo "  Profile  : ${K6_PROFILE}"
    echo "  Target   : ${BASE_URL}"
    echo "  Summary  : ${summary_file}"
    echo "  Log      : ${log_file}"
    echo "============================================================"

    # Build k6 --out arguments
    local out_args=()
    if [[ -n "${PROMETHEUS_RW_URL:-}" ]]; then
        out_args+=(--out "experimental-prometheus-rw=${PROMETHEUS_RW_URL}")
    fi

    # Export variables for k6 scripts (__ENV)
    local env_args=(
        -e "BASE_URL=${BASE_URL}"
        -e "TENANT_ID=${TENANT_ID}"
        -e "CLIENT_ID=${CLIENT_ID}"
        -e "CLIENT_SECRET=${CLIENT_SECRET}"
        -e "K6_PROFILE=${K6_PROFILE}"
    )

    k6 run \
        "${env_args[@]}" \
        ${out_args[@]+"${out_args[@]}"} \
        --summary-export "${summary_file}" \
        "${script}" > "${log_file}" 2>&1
    local k6_exit=$?

    # Print the final summary block (last ~20 lines contain the k6 end-of-run table)
    tail -20 "${log_file}"

    if [[ "${k6_exit}" -eq 0 ]]; then
        echo "PASS: ${scenario}"
        return 0
    else
        echo "FAIL: ${scenario} (thresholds breached or error)"
        echo "  Full output: ${log_file}"
        return 1
    fi
}

for scenario in "${RUN_SCENARIOS[@]}"; do
    if ! run_scenario "${scenario}"; then
        FAILED_SCENARIOS+=("${scenario}")
    fi

    last_idx=$(( ${#RUN_SCENARIOS[@]} - 1 ))
    if [[ "${scenario}" != "${RUN_SCENARIOS[${last_idx}]}" ]]; then
        echo "Pausing ${PAUSE_BETWEEN}s before next scenario..."
        sleep "${PAUSE_BETWEEN}"
    fi
done

# ---------------------------------------------------------------------------
# Final report
# ---------------------------------------------------------------------------
echo ""
echo "============================================================"
echo "  Load Test Summary"
echo "============================================================"
echo "  Ran      : ${#RUN_SCENARIOS[@]} scenario(s)"
echo "  Results  : ${SUMMARY_DIR}/"

if [[ ${#FAILED_SCENARIOS[@]} -eq 0 ]]; then
    echo "  Status   : ALL PASSED"
    exit 0
else
    echo "  FAILED   : ${FAILED_SCENARIOS[*]}"
    exit 1
fi
