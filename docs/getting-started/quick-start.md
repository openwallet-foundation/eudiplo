# Quick Start

Get EUDIPLO running in under 2 minutes! This guide gets you from zero to issuing
your first credential.

!!! tip "New to EUDIPLO?"

    This is the fastest path to see EUDIPLO working. For
    production setup and advanced configuration, see the
    [Architecture](../architecture/index.md) and [API](../api/index.md) sections.

---

## What You'll Need

- CLI access via one of these options:
    - Option A (recommended on Linux/macOS): standalone CLI via installer
    - Option B: npm package `@eudiplo/cli` with [Node.js 22+](https://nodejs.org/)
    - Windows: `npx @eudiplo/cli demo` (Node.js 22+) or Windows x64 release archive
- [Docker](https://www.docker.com/get-started) installed
- 2 minutes of your time ⏱️

---

## Step 1: Start the Demo with the CLI (Recommended)

### Linux and macOS: Standalone CLI (recommended)

```bash
curl -fsSL https://eudiplo.dev/install.sh | bash
eudiplo demo
```

### Already using Node.js 22+?

```bash
npx @eudiplo/cli demo
```

### Windows

Use Node.js 22+:

```powershell
npx @eudiplo/cli demo
```

or download the Windows x64 standalone release archive and run:

```powershell
eudiplo demo
```

Both options run the same **EUDIPLO CLI**. The standalone CLI removes the
Node.js requirement, but Docker and Docker Compose are still required for
`eudiplo demo`.

This generates editable demo files in your current directory:

- `.eudiplo.demo.env`
- `.eudiplo/demo-config`

It then starts backend and client containers using compatible image tags.

!!! warning "Demo mode only"

        Demo mode uses predictable onboarding credentials and loopback-bound ports.
        It is not suitable for production.

---

## Step 2: Verify It's Working

After starting the demo, check that EUDIPLO is healthy by querying its health endpoint:

```bash
curl http://localhost:3000/health
```

**Expected response from EUDIPLO:**

```json
{
    "status": "ok",
    "info": {
        "database": { "status": "up" }
    },
    "errors": {}
}
```

---

## Step 3: Continue with the CLI (Recommended)

The CLI is the primary workflow for local onboarding and lifecycle commands.
Use the same mode you chose in Step 1:

```bash
# Stop demo stack
eudiplo down

# npm alternative
npx @eudiplo/cli down

# Reset demo data and regenerate demo config
eudiplo demo --reset --force

# npm alternative
npx @eudiplo/cli demo --reset --force
```

You can still use the Web Client or Swagger API at any time:

=== "🖥️ Web Client (Recommended for beginners)"

    **Open the Web Interface**:

    - URL: http://localhost:4200

    The web client provides a user-friendly interface for:

    - 📋 Managing credential templates
    - 🎫 Issuing credentials to wallets
    - ✅ Verifying credential presentations
    - 📊 Viewing system status

    !!! tip "Perfect for first-time users"
        The web client is the easiest way to understand EUDIPLO's capabilities without needing API knowledge.

=== "🔧 Swagger API (For developers)"

    **Open the API Documentation**: http://localhost:3000/api/docs

    The Swagger UI provides direct API access for:

    - 🔌 Integration testing
    - 📖 API documentation exploration
    - ⚡ Advanced automation workflows
    - 🧪 Direct endpoint testing

---

## Step 4: Optional UI and API Exploration

After starting with the CLI, choose an interface for interactive exploration:

=== "🖥️ Using the Web Client"

    1. **Open**: http://localhost:4200
    2. **Log in** with the default credentials:
        - **EUDIPLO Instance**: `http://localhost:3000`
        - **Client ID**: `root`
        - **Client Secret**: `root`
    3. **Explore** the dashboard to see:
        - Available credential templates
        - Quick action buttons for common tasks

    !!! tip "Learn More"
        For detailed web client features and workflows, see the **[Web Client Guide](./web-client.md)**.

=== "🔧 Using the Swagger API"

    ### Authenticate via Swagger UI

    1. **Open the API Documentation**: http://localhost:3000/api/docs
    2. **Click the "Authorize" button** (🔓 lock icon) in the top-right
    3. **Enter your credentials**:
        - **Client ID**: `root`
        - **Client Secret**: `root`
    4. **Click "Authorize"** and then **"Close"**

    You're now authenticated! The 🔓 icon should change to 🔒 (locked).

    ### Test Your First API Call

    5. **Find the "App" section** in Swagger UI
    6. **Expand** `/` → **GET**
    7. **Click "Try it out"** → **"Execute"**

    You should see a successful response with available credential templates!

---

## Success

EUDIPLO is now running and ready for credential issuance and verification.

### What's Next?

!!! tip "New to EUDIPLO? Start here!"

    Follow the **[First Steps Guide](./first-steps.md)** for a complete walkthrough:

    1. Create your first tenant
    2. Set up credential configurations
    3. Issue your first credential
    4. Troubleshoot common issues

=== "🖥️ Web Client Users"

- 📚 **[First Steps Guide](./first-steps.md)** - Complete setup walkthrough (recommended)
- 🎫 **Issue Your First Credential** - Use the web interface to create and send credentials to wallets
- 🔍 **Verify Credentials** - Set up verification flows through the web UI
- 📋 **Manage Templates** - Create custom credential templates for your use case

=== "🔧 API Users"

- 📚 **[First Steps Guide](./first-steps.md)** - Complete setup walkthrough (recommended)
- 🎫 **[Issue Your First Credential](./issuance/index.md)** - Learn credential issuance flows
- 🔍 **[Verify Credentials](./presentation/index.md)** - Set up credential verification
- 🔌 **[API Integration](../api/index.md)** - Integrate EUDIPLO into your applications

### Common Next Steps

- ⚙️ **[Production Setup](../architecture/index.md)** - Deploy for production use
- 🔐 **[Security Configuration](../api/authentication.md)** - Replace default credentials
- 🏗️ **[Architecture Overview](../architecture/index.md)** - Understand system design

### Clean Up

When you're done experimenting:

Use the same CLI mode from Step 1:

```bash
eudiplo down

# npm alternative
npx @eudiplo/cli down
```

To reset managed demo data and regenerate demo config:

```bash
npx @eudiplo/cli demo --reset --force
# or
eudiplo demo --reset --force
```
