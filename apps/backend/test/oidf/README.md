# OIDF HAIP Wallet Provider Trust

The HAIP issuance fixture requires wallet attestation on its built-in authorization
server. Before running issuance modules, the test setup publishes a signed wallet
provider list through EUDIPLO at
`/issuers/haip/trust-list/oidf-wallet-providers`.

The list contains the independently generated CA certificates for both wallet
attestations and key attestations. Each run creates or updates the managed list,
then configures the issuance-level `walletProviderTrustLists` with its internal
HTTPS URL and pinned signing certificate (`verifierX509Der`). The authorization
server inherits this list; the credential endpoint uses it for key attestations.
Setup fetches and verifies the hosted list before starting the modules. No mock
HTTP endpoint or externally provisioned wallet-provider list is needed.

These generated CAs are test trust anchors. The existing `pid-tl.json` serves
credential-provider trust and is separate from this wallet-provider list.
Ordinary issuance E2E helpers explicitly disable the AS wallet-attestation
requirement because those tests do not send wallet attestations.

# OIDF E2E Timing Calibration

Use this note to set OIDF wait thresholds based on measured timing instead of guesswork.

## Why measure first

OIDF suite response times vary by machine and CI load. Hardcoded waits that are too high hide hangs and make failures slow. Waits that are too low can make healthy runs flaky.

## What to measure

For each module run, track these two phases:

1. Runner boot phase: from creating the runner to first `WAITING` state.
2. Completion phase: from first polling call in `waitForFinished()` to terminal status (`FINISHED` or `INTERRUPTED`).

## Quick baseline process

1. Run a representative subset (10-20 modules) on the target environment.
2. Capture timing from test logs:
   - `Module finished (...) in <duration>ms` gives end-to-end module time.
   - On timeout/fail-fast, `Poll checkpoints` includes elapsed times and status progression.
3. Record p50 and p95 for each phase.
4. Set thresholds from p95, not p50.

## Suggested starting values

These are practical defaults for local/CI until you have your own baseline:

- `OIDF_WAIT_POLL_INTERVAL_MS=300`
- `OIDF_WAIT_NO_PROGRESS_ATTEMPTS_WAITING=40` (about 12s)
- `OIDF_WAIT_NO_PROGRESS_ATTEMPTS=120` (about 36s)
- `OIDF_WAIT_MAX_ATTEMPTS=240` (about 72s)

## Speed knobs (local runs)

- `OIDF_EXPORT_LOGS=false`
  - Skips HTML log archive export in `afterAll` for faster local runs.
- `OIDF_TEARDOWN_PER_FILE=false`
  - Reuses OIDF Testcontainers across OIDF spec files in the same vitest worker and tears down on process exit.
- `OIDF_TEARDOWN_PER_FILE=true`
  - Default. Uses strict per-file teardown behavior for maximum isolation.

## Tuning rule of thumb

1. `WAITING` no-progress limit:
   - Start around `ceil(p95_waiting_ms / poll_interval_ms) + 5`.
   - Keep this strict because hangs often remain in `WAITING`.
2. Global no-progress limit:
   - Start around `ceil(p95_non_waiting_stall_ms / poll_interval_ms) + 10`.
3. Max attempts:
   - Keep at least 2x global no-progress attempts.

## Example

If measured p95 for initial `WAITING` is 4300ms with 300ms polling:

- `ceil(4300 / 300) + 5 = 20`
- Choose `OIDF_WAIT_NO_PROGRESS_ATTEMPTS_WAITING=20`.

## Operational recommendation

Re-calibrate when:

- OIDF suite image changes,
- CI runner type changes,
- networking/container stack changes.

Keep one baseline note per environment (local laptop, CI) in your team docs or PR description for visibility.
