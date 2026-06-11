# Web Client

EUDIPLO provides a user-friendly web interface for credential management—no API expertise required. Simply enter your instance URL and credentials to get started. There's no need to deploy a separate client for each instance.

There is no need to use the client to interact with EUDIPLO, but it offers a more intuitive way to manage the configurations.

## Getting Started

### Accessing the Web Client

After completing the [Full Setup](./quick-start.md#step-1-choose-your-setup):

1. **Open your browser** and go to: [http://localhost:4200](http://localhost:4200)
2. **Login** using the default credentials:
    - **Username:** `root`
    - **Password:** `root`

### Hosting from a Subpath

If the client is served from a path such as `https://example.com/client/`, set `CLIENT_BASE_HREF=/client/` when starting the client. This updates the HTML base href and keeps routing and asset loading correct for the subpath.

If you are using a reverse proxy, it must also forward `/client/` to the client container. See [Serving the Client from a Subpath](../deployment/tls.md#serving-the-client-from-a-subpath) for a full example.

> **Important:** Change the default credentials before using EUDIPLO in production. See [Authentication](../api/authentication.md) for details.

---

## Dashboard Overview

The dashboard offers:

- **Quick Actions:** One-click access to common tasks
- **Statistics:** Usage metrics and activity summaries _(coming soon)_

---

## Core Features

### 🎫 Credential Issuance Management

- Create, edit, import, or delete credential and issuance configurations
- Import keys and certificates, and link them to configurations

### ✅ Credential Verification

- Manage verification flows
- Create, edit, import, or delete verification configurations

### 📋 Session Management

- View and manage active issuance and verification sessions
- Inspect session details, including parameters

### 🧑‍💼 Client Management

- Create new tenants with client ID and secret (Keycloak only)
- Not supported for other identity providers or when using EUDIPLO as IAM yet

---

## Configuration Editing & Validation

The web client is designed for intuitive and robust configuration management:

- **Data Model & Validation:** The EUDIPLO service uses decorators on data transfer objects (DTOs) and entities to describe variables and their values, enabling server-side validation.
- **OpenAPI Specification:** An OpenAPI spec is generated from these DTOs and entities, providing a standardized interface for backend interaction.
- **SDK Integration:** The web client uses an SDK generated from the OpenAPI spec for seamless and type-safe communication with the backend.
- **Editing Experience:**
    - Simple variables (strings, numbers, booleans) are edited via text inputs, select options, or checkboxes.
    - Complex data structures are managed using an integrated JSON editor (Monaco Editor), which leverages JSON schemas for each variable.

- **Client-Side Validation & Guidance:** The JSON editor uses the provided JSON schemas to offer inline descriptions, auto-completion, and validation directly in the browser.
- **Direct JSON Access:** Each configuration can be viewed and edited as raw JSON for advanced use cases.
