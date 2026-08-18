# CLI Local Development

Run these commands from the repository root:

```bash
pnpm --filter @eudiplo/cli test
pnpm --filter @eudiplo/cli build
pnpm --filter @eudiplo/cli lint
```

## Run source changes directly

The `dev` script runs the CLI through `tsx`, so changes can be verified without
installing or publishing a package:

```bash
pnpm --filter @eudiplo/cli dev config validate tenant ../../assets/config/playground
pnpm --filter @eudiplo/cli dev config validate tenants ../../assets/config --format json
```

The first command validates the checked-in playground tenant configuration and
is a useful smoke test for schema and validator changes.

## Test the standalone artifact

Build the local Node.js SEA executable and run it directly before creating a
release:

```bash
pnpm --filter @eudiplo/cli build:sea
apps/cli/dist-sea/eudiplo config validate tenant assets/config/playground
```

The build synchronizes and validates bundled CLI assets from these canonical
sources:

- `deployment/docker-compose/docker-compose.yml`
- `assets/config/demo/**`
- `schemas/*.schema.json` referenced by `apps/cli/src/config-validate/registry.json`

Run `pnpm run gen:api` after changing backend import schemas so the generated
schema copies are updated before building the CLI.
