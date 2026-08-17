# Development

EUDIPLO is organized as a **monorepo workspace** containing multiple applications:

- **Backend**: NestJS API server (`apps/backend/`)
- **Client**: Angular web interface (`apps/client/`)
- **Webhook**: Cloudflare Worker for testing (`apps/webhook/`)

## Quick Start

```bash
# Install all dependencies
pnpm install

# Start all applications
pnpm run dev

# Or start specific applications
pnpm --filter @eudiplo/backend run start:dev
pnpm --filter @eudiplo/client run dev
```

See [Workspace Structure](workspace-structure.md) for the monorepo layout and
[Backend Structure](backend-structure.md) for backend ownership and dependency
rules.

## Backend (NestJS)

The backend is built with [NestJS](https://nestjs.com/), a progressive Node.js framework for building efficient, scalable server-side applications using TypeScript.

## Documentation with Compodoc

[Compodoc](https://compodoc.app) provides a comprehensive overview of the
codebase, including:

- Modules
- Controllers
- Services
- DTOs
- Dependencies

```bash
pnpm run compodoc:start
```

A [rendered version](../compodoc/index.html) is included.

## Source Code Structure

Each module typically contains its own:

- `controller.ts` — API endpoints
- `service.ts` — Business logic
- `dto/` — Data Transfer Objects
- `entities/` — TypeORM entities (if needed)

## Additional Documentation

- [API Authentication](../api/authentication.md) - Guide for using OAuth2
  authentication with the API
- [Backend Structure](backend-structure.md) - Module ownership and dependency boundaries
- [Code Quality Standards](code-quality.md) - Code formatting, linting, and style guidelines
- [Contributing Guidelines](contributing.md) - How to contribute to the project
- [Testing Guide](testing.md) - How to run and write tests
- [Logging](./logging-configuration.md) - Configuring logging for development
  and production
- [Documentation Versioning](documentation-versioning.md) - Managing documentation versions

## Scripts

Useful development scripts:

```bash
# Development
pnpm run start:dev        # Start the app in watch mode
pnpm run start:debug      # Start with debug mode and watch
pnpm run build            # Build the application

# Testing
pnpm run test             # Run unit tests
pnpm run test:watch       # Run tests in watch mode
pnpm run test:e2e         # Run end-to-end tests
pnpm run test:cov         # Run tests with coverage
pnpm run test:debug       # Run tests with debug mode

# Code Quality
pnpm run format           # Format all files with Biome
pnpm run format:check     # Check formatting without changes
pnpm run lint             # Run linting checks
pnpm run lint:fix         # Fix linting issues automatically

# Documentation
pnpm run compodoc         # Generate Compodoc documentation
pnpm run compodoc:serve   # Serve Compodoc docs locally (port 3001)
pnpm run doc:watch        # Serve MkDocs documentation with live reload
pnpm run doc:build        # Build all documentation (Swagger + Compodoc + MkDocs)
```

> 💡 Compodoc output is stored in the `doc/compodoc` folder and served
> statically by the application.

---

## Contributions

Feel free to contribute by improving documentation, fixing bugs, or extending
functionality. Make sure to follow the coding standards and write tests where
applicable.
