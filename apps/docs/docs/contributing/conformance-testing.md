---
title: Conformance Testing
---

# OIDF Conformance Testing

EUDIPLO includes dedicated tests for validating compliance with the [OpenID Foundation (OIDF) conformance suite](https://openid.net/certification/conformance/) for OID4VCI and OID4VP. These tests ensure that the implementation of OID4VCI (OpenID for Verifiable Credential Issuance) and OID4VP (OpenID for Verifiable Presentations) strictly follows the protocol specifications.

## Running Conformance Tests

The conformance tests are part of the E2E test suite and run automatically in the GitHub Actions CI pipeline for pull requests and on the `main` branch.

To run them locally:

```bash
pnpm --filter @eudiplo/backend run test:oidf
```

## Test Structure

The OIDF conformance tests are located at:

- `apps/backend/test/oidf/oidf-issuance.e2e-spec.ts` — OID4VCI issuer conformance tests
- `apps/backend/test/oidf/oidf-presentation.e2e-spec.ts` — OID4VP verifier conformance tests
- `apps/backend/test/oidf/oidf-setup.ts` — Shared OIDF test infrastructure
- `apps/backend/test/oidf/oidf-suite.ts` — OIDF suite integration client

## Environment Variables

The conformance tests can be configured with these environment variables:

- `VITE_OIDF_URL` — OIDF conformance suite URL (default: `https://localhost:8443`)
- `VITE_OIDF_DEMO_TOKEN` — Authentication token for the OIDF suite
- `VITE_OIDF_MODULES` — Comma-separated list of module filters
- `VITE_OIDF_MODULE_PATTERN` — Regular expression pattern for module filtering
- `VITE_OIDF_ENFORCE_MODULE_COVERAGE` — Fail on uncovered scenarios (default: `false`)
- `OIDF_EXPORT_LOGS` — Export OIDF test logs to `tmp/oidf-logs/` (enabled in CI)

## Test Workflow

1. **Container Setup** — The tests use containerized OIDF conformance suite instances
2. **Plan Creation** — Test plans are created for each protocol variant
3. **Test Execution** — Individual conformance modules are executed against the EUDIPLO backend
4. **Result Validation** — Test results are validated and logs are exported for failed tests
5. **Coverage Reporting** — Module coverage is tracked and reported

## Module Coverage

The tests maintain snapshot files that track which conformance modules are covered:

- `apps/backend/test/oidf/oidf-issuer-modules.snapshot.json`
- `apps/backend/test/oidf/oidf-verifier-modules.snapshot.json`

These snapshots are validated against the live OIDF plan and auto-updated when the conformance suite introduces new modules.

## Log Export

Failed test logs are automatically exported to:

- `tmp/oidf-logs/failed/{testInstanceId}/` — Individual failed test logs
- `tmp/oidf-logs/{planId}/` — Complete plan logs

These logs are uploaded as artifacts in GitHub Actions for debugging.

## CI/CD Integration

The conformance tests run in a separate job in the CI pipeline:

```yaml
test-e2e-oidf:
  name: E2E Tests (OIDF)
  runs-on: ubuntu-latest
  steps:
    - name: Run OIDF E2E tests
      run: pnpm run --filter @eudiplo/backend test:oidf
```

See `.github/workflows/ci-and-release.yml` for the complete workflow configuration.

## Certification Status

EUDIPLO is tested against the OIDF conformance suite for:

- **OID4VCI** — OpenID for Verifiable Credential Issuance
- **OID4VP** — OpenID for Verifiable Presentations

The conformance test results validate that EUDIPLO implements these protocols according to the official specifications.
