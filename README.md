![Logo](./docs/eudiplo.png)

[![Build Status](https://github.com/openwallet-foundation/eudiplo/actions/workflows/ci-and-release.yml/badge.svg)](https://github.com/openwallet-foundation/eudiplo/actions)
![License](https://img.shields.io/github/license/openwallet-foundation/eudiplo)
[![Website](https://img.shields.io/badge/website-eudiplo-blue)](https://openwallet-foundation.github.io/eudiplo/latest/)
[![Documentation Coverage](https://openwallet-foundation.github.io/eudiplo/main/compodoc/images/coverage-badge-documentation.svg)](https://openwallet-foundation.github.io/eudiplo/main/compodoc/coverage.html)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=openwallet-foundation_eudiplo&metric=coverage)](https://sonarcloud.io/project/overview?id=openwallet-foundation_eudiplo)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=openwallet-foundation_eudiplo&metric=security_rating)](https://sonarcloud.io/project/overview?id=openwallet-foundation_eudiplo)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=openwallet-foundation_eudiplo&metric=alert_status)](https://sonarcloud.io/project/overview?id=openwallet-foundation_eudiplo)
[![Join our Discord](https://img.shields.io/discord/1022962884864643214?label=Join%20our%20Discord&logo=discord&color=7289DA&labelColor=2C2F33)](https://discord.gg/58ys8XfXDu)

# Your Diplomatic Layer for EUDI Wallet Integration

EUDIPLO is an open-source middleware that bridges your backend and EUDI Wallets
using a unified API and standardized protocols.

---

## 🧭 Overview

Organizations joining the EUDI Wallet ecosystem face a tough choice: patch
together protocol libraries that may not exist for their stack, or rely on
proprietary solutions that risk vendor lock-in.

**EUDIPLO** solves this by providing a lightweight, source-available, protocol
abstraction layer. It communicates over HTTP and integrates easily with your
existing backend stack—so you can focus on your business logic, not
cryptographic plumbing.

It supports all core flows of electronic attribute attestations—**issuing**,
**requesting**, and even **requesting during issuance**—and is already
compatible with multiple
[wallets](./docs/getting-started/wallet-compatibility.md).

While still in early development, EUDIPLO is built for production: secure key
management, scalable database support, and clean API boundaries.

## ![Overview](./docs/overview.excalidraw.svg)

## 🧩 Features

- ✅ Supports **OID4VCI**, **OID4VP**, **SD-JWT VC**, **mDOC (ISO 18013-5)**, and **OAuth Token Status
  List**
- ✅ **OIDF conformance tested** for OID4VCI and OID4VP protocols
- ✅ JSON-based credential configuration
- ✅ Client credentials authentication for easy service integration
- ✅ Runs via Docker with `.env` config
- ✅ HTTP-based integration with any backend
- ✅ Secure key management & pluggable storage
- ✅ Privacy-friendly: no external calls, no long-term storage

---

## 📺 Watch the Webinar

Curious about EUDIPLO? Check out our recorded webinar (September 17, 2025) for a deep dive into features, architecture, and live Q&A:

[![EUDIPLO Webinar](https://img.youtube.com/vi/GQlvHK-EFlU/0.jpg)](https://www.youtube.com/watch?v=GQlvHK-EFlU)

[Watch on YouTube](https://www.youtube.com/watch?v=GQlvHK-EFlU)

## 🤝 Community Call

Join our bi-weekly community call every Thursday:

[Participate via Zoom](https://zoom-lfx.platform.linuxfoundation.org/meeting/94494306854?password=0d272140-5b2b-4bd4-a8fe-0b70efe1aa86)

## 🚀 Quick Start

### Demo Setup (Easiest)

For quick testing and demos:

```bash
# Clone the repository
git clone https://github.com/openwallet-foundation/eudiplo.git
cd eudiplo

# Create .env with demo credentials
cp .env.example .env
echo "MASTER_SECRET=$(openssl rand -base64 32)" >> .env
echo "AUTH_CLIENT_ID=demo" >> .env
echo "AUTH_CLIENT_SECRET=demo-secret" >> .env

# Start services
docker compose up -d

# Access the services
# Backend API: http://localhost:3000
# Client UI: http://localhost:4200
```

⚠️ **Remember to change credentials for production!**

### Option 1: Using Docker Compose (Recommended for Production)

```bash
# Clone and configure
git clone https://github.com/openwallet-foundation/eudiplo.git
cd eudiplo
cp .env.example .env

# Configure secure authentication (all three are REQUIRED)
echo "MASTER_SECRET=$(openssl rand -base64 32)" >> .env
echo "AUTH_CLIENT_ID=my-client" >> .env
echo "AUTH_CLIENT_SECRET=$(openssl rand -base64 24)" >> .env

# Start both backend and client with Docker Compose
docker compose up -d

# Access the services
# Backend API: http://localhost:3000
# Client UI: http://localhost:4200
```

### Option 2: Using Individual Docker Images

```bash
# Run just the backend
docker run -p 3000:3000 \
  -e PUBLIC_URL=https://example.com \
  -e MASTER_SECRET=your-32-character-secret \
  -e AUTH_CLIENT_ID=your-client-id \
  -e AUTH_CLIENT_SECRET=your-client-secret \
  -v $(pwd)/assets:/app/config \
  ghcr.io/openwallet-foundation/eudiplo:latest

# Run the client (optional - web interface)
docker run -p 4200:80 \
  -e API_BASE_URL=http://localhost:3000 \
  ghcr.io/openwallet-foundation/eudiplo-client:latest
```

### Option 3: Local Development

```bash
# Install dependencies
pnpm install

# Start backend
pnpm --filter @eudiplo/backend run start:dev

# Start client (in another terminal)
pnpm --filter @eudiplo/client run dev
```

### Get Started with the API

```bash
# Get a token and start using the API
# Replace with your configured AUTH_CLIENT_ID and AUTH_CLIENT_SECRET
curl -X POST http://localhost:3000/api/oauth2/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "your-client-id",
    "client_secret": "your-client-secret"
  }'
```

📚 API:
[https://openwallet-foundation.github.io/eudiplo/latest/api/](https://openwallet-foundation.github.io/eudiplo/latest/api/)  
📦
Full setup:
[Quickstart Guide](https://openwallet-foundation.github.io/eudiplo/latest/getting-started/quick-start/)

---

## 📚 Documentation

**Choose your documentation version:**

- 🚀 **Latest Stable** (recommended):
  [https://openwallet-foundation.github.io/eudiplo/latest/](https://openwallet-foundation.github.io/eudiplo/latest/) -
  Documentation for the most recent major release
- 🔬 **Development**:
  [https://openwallet-foundation.github.io/eudiplo/main/](https://openwallet-foundation.github.io/eudiplo/main/) -
  Latest features from the main branch
- 📚 **Specific Major Versions**:
  [v1](https://openwallet-foundation.github.io/eudiplo/1/),
  [v2](https://openwallet-foundation.github.io/eudiplo/2/), etc.

**Key sections:**

- [Architecture](https://openwallet-foundation.github.io/eudiplo/latest/architecture/)
- [Supported Protocols](https://openwallet-foundation.github.io/eudiplo/latest/architecture/supported-protocols/)
- [API Reference](https://openwallet-foundation.github.io/eudiplo/latest/api/)
- [Code Documentation](https://openwallet-foundation.github.io/eudiplo/latest/compodoc/)

---

## 🤝 Contributing

We welcome PRs from wallet developers, institutions, and contributors interested
in advancing the EUDI Wallet ecosystem.

See [CONTRIBUTING.md](CONTRIBUTING.MD) for guidelines.

💬 **Have questions?** Join our
[Discord community](https://discord.gg/58ys8XfXDu) to ask questions, get help,
and connect with other developers.

---

## 📝 License

Licensed under the [Apache 2.0 License](LICENSE)
