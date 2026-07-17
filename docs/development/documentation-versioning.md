# Documentation Publishing

EUDIPLO uses GitHub Pages to publish a combined site:

- Website landing page at `/`
- Documentation at `/docs/`

## How It Works

### Automatic Deployment

On pushes to `main`, CI:

1. Builds the docs site with MkDocs
2. Assembles a Pages artifact where:
    - `website/index.html` is published at site root
    - built docs are published under `docs/`
3. Deploys that artifact through GitHub Pages

### Access URLs

Once deployed:

- **Primary website**: [https://openwallet-foundation.github.io/eudiplo/](https://openwallet-foundation.github.io/eudiplo/)
- **Documentation**: [https://openwallet-foundation.github.io/eudiplo/docs/](https://openwallet-foundation.github.io/eudiplo/docs/)

### Local Development

For local docs development:

```bash
# Serve docs locally with live reload
pnpm run doc:watch

# Build docs locally
pnpm run doc:build
```

### Manual Deployment

Manual deployment follows the same GitHub Actions workflow in the repository
Actions tab.

## Structure

- Documentation lives in the `docs/` directory
- API documentation is auto-generated from Swagger/OpenAPI specs
- Code documentation is auto-generated using Compodoc
- The site is built using MkDocs with the Material theme
