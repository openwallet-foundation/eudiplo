---
title: E2E Testing
---

# E2E Testing

Backend E2E tests are stored in `apps/backend/test/`. They verify the assembled application, including protocol flows and integrations with external services.

## Running E2E Tests

The following command will run the E2E tests and also provide a coverage report:

```bash
pnpm --filter @eudiplo/backend run test:e2e
```

During test development, you can use watch mode to automatically re-run tests on file changes:

```bash
pnpm --filter @eudiplo/backend run test:e2e:watch
```

## Test Organization

E2E tests live in `apps/backend/test/*.e2e-spec.ts` files (not co-located with source code).

Common test categories include:

- **Protocol flows** — OID4VCI and OID4VP end-to-end scenarios
- **Configuration portability** — Import/export and startup config tests
- **Integration tests** — Database, KMS, and external service integration

## Coverage

Coverage reports are generated in the `/coverage` folder and are also available via [codecov](https://app.codecov.io/github/openwallet-foundation/eudiplo/tree/main).

## Playwright E2E (Future)

A `playwright/` directory exists at the repository root for potential browser-based E2E tests. This infrastructure is planned for future client UI testing.
