# Documentation Publishing

EUDIPLO uses GitHub Pages to publish a combined site:

- Website landing page at `/`
- Versioned documentation under `/docs/` using mike

## How It Works

### Automatic Deployment

On pushes to `main`, CI:

1. Generates docs content (`doc:generate`, Compodoc)
2. Runs mike deployment with `--deploy-prefix docs`
3. Publishes a Pages artifact where:
    - `website/index.html` is published at site root (`/`)
    - mike-managed docs are published under `/docs/`
4. Deploys that artifact through GitHub Pages

### Version Behavior

- `main` is deployed on each push to `main`
- `latest-dev` is updated as an alias to `main`
- Default docs version under `/docs/` points to `main`

### Access URLs

Once deployed:

- **Primary website**: [https://openwallet-foundation.github.io/eudiplo/](https://openwallet-foundation.github.io/eudiplo/)
- **Documentation root**: [https://openwallet-foundation.github.io/eudiplo/docs/](https://openwallet-foundation.github.io/eudiplo/docs/)
- **Main docs**: [https://openwallet-foundation.github.io/eudiplo/docs/main/](https://openwallet-foundation.github.io/eudiplo/docs/main/)
- **Latest dev alias**: [https://openwallet-foundation.github.io/eudiplo/docs/latest-dev/](https://openwallet-foundation.github.io/eudiplo/docs/latest-dev/)

When major versions are deployed with mike (for example `1`, `2`), they are
available under `/docs/<version>/`.

### Local Development

For local docs development:

```bash
# Serve docs locally with live reload
pnpm run doc:watch

# Build docs locally
pnpm run doc:build

# Serve mike versioned docs locally
pnpm run doc:serve-versions
```

### Manual Deployment

Manual deployment follows the same GitHub Actions workflow in the repository
Actions tab.

## Structure

- Documentation lives in the `docs/` directory
- API documentation is auto-generated from Swagger/OpenAPI specs
- Code documentation is auto-generated using Compodoc
- The site is built using MkDocs with the Material theme and versioned with mike
