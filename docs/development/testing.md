# Testing

EUDIPLO is designed to be robust and easy to test both in development and CI
environments. This guide outlines how to run, write, and automate tests for the
project.

The current focus is on end-to-end (E2E) tests, which verify the overall
functionality of the application.

---

## OIDF Conformance Tests

EUDIPLO includes dedicated tests for validating compliance with the [OpenID Foundation (OIDF) conformance suite](https://openid.net/certification/conformance/) for OID4VCI and OID4VP. These tests ensure that the implementation of OID4VCI (OpenID for Verifiable Credential Issuance) and OID4VP (OpenID for Verifiable Presentations) strictly follows the protocol specifications.

The test are part of the E2E tests that run in the Github Action CI pipeline for a pull request and on the `main` branch.

---

## E2E Tests

Right now EUDIPLO has only implemented end-to-end (E2E) tests that are stored in
the `/test` folder. These tests are designed to verify the overall functionality
of the application, including interactions with external services like the EUDI
Wallet.

The following command will run the E2E tests and also provide a coverage report:

```bash
pnpm run test:e2e
```

It is also accessible via
[codecov](https://app.codecov.io/github/openwallet-foundation/eudiplo/tree/main).

---

## Code Quality (SonarCloud)

Static analysis and code quality metrics are tracked on
[SonarCloud](https://sonarcloud.io/project/overview?id=openwallet-foundation_eudiplo).

!!! info "Scope"

    The SonarCloud analysis focuses on the **backend** (`apps/backend`). The Angular client is excluded from coverage reporting as it is considered optional and does not have E2E test coverage yet.

During writing E2E tests, you can use it in watch mode to automatically re-run
tests on file changes:

```bash
pnpm run test:e2e:watch
```

---

## Linting

Before pushing code, check linting rules and fix them:

```bash
pnpm run lint
```

---

## GitHub Actions

Tests run automatically on every push to `main` or pull request via GitHub
Actions.

You can find the workflow config in `.github/workflows/ci-and-release.yml`.

---

## Running Tests Locally

To run all unit and integration tests locally:

```bash
pnpm run test
```

Or with watch mode:

```bash
pnpm run test:watch
```

This uses [Vitest](https://vitest.dev) under the hood, which is configured for
NestJS.

---

## Test Coverage

The coverage is generated when running the E2E tests.

This generates a report in the `/coverage` folder. Open `coverage/index.html` in
your browser to view it.

---

## Test Structure

Tests are located next to their implementation files:

```bash
src/
  service/
    my.service.ts
    my.service.spec.ts  <-- Test file
```

!!! Info

    At this point EUDIPLO only has E2E tests. Unit and integration tests may be added
    in the future.
