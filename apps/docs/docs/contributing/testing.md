---
title: Testing
---

# Testing

EUDIPLO uses Vitest for colocated unit tests and backend end-to-end (E2E) tests. Run focused unit tests while developing, then add the relevant E2E suite when a change affects module wiring, persistence, or a protocol flow.

## Running Tests Locally

To run all workspace unit tests locally:

```bash
pnpm run test
```

To target the backend or use watch mode:

```bash
pnpm --filter @eudiplo/backend run test
pnpm --filter @eudiplo/backend run test:watch
```

This uses [Vitest](https://vitest.dev) under the hood, which is configured for NestJS.

## Test Structure

Unit tests are located next to their implementation files:

```bash
src/
  service/
    my.service.ts
    my.service.spec.ts  <-- Test file
```

Architecture and dependency-boundary tests also use the `.spec.ts` suffix, so they run with the same backend unit-test command.

## Linting

Before pushing code, check linting rules and fix them:

```bash
pnpm run lint
```

The repository's Git pre-push hook also runs the Knip check automatically:

```bash
pnpm run knip
```

Install dependencies with `pnpm install` to enable the Husky hooks locally.

## GitHub Actions

Tests run automatically on every push to `main` or pull request via GitHub Actions.

You can find the workflow config in `.github/workflows/ci-and-release.yml`.

## Test Coverage

Coverage is generated when running the E2E tests. See [E2E Testing](./e2e-testing.md) for details.

This generates a report in the `/coverage` folder. Open `coverage/index.html` in your browser to view it.

Coverage is also accessible via [codecov](https://app.codecov.io/github/openwallet-foundation/eudiplo/tree/main).

## Code Quality (SonarCloud)

Static analysis and code quality metrics are tracked on [SonarCloud](https://sonarcloud.io/project/overview?id=openwallet-foundation_eudiplo).

:::info[Scope]
The SonarCloud analysis focuses on the **backend** (`apps/backend`). The Angular client is excluded from coverage reporting as it is considered optional and does not have E2E test coverage yet.
:::
