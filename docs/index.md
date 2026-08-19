![EUDIPLO Logo](./eudiplo.png)

# What is EUDIPLO?

**EUDIPLO** is a lightweight, open-source **middleware layer** that bridges your
IT systems with the **European Digital Identity Wallet (EUDI Wallet)**
ecosystem.

Whether you're building services for government, education, healthcare, or the
private sector—EUDIPLO lets you interact with EUDI Wallets using simple
JSON-based APIs, without having to implement complex identity protocols
yourself.

!!! info "EUDIPLO stands for EUDI Protocol Liaison Operator"

    The name EUDIPLO is inspired by diplomat — because this middleware acts as
    a translator and trusted go-between. It speaks fluent EUDI specs on one side
    and down-to-earth JSON on the other, making sure your backend doesn't have to
    become a protocol expert overnight.

---

## Why EUDIPLO?

Connecting to the EUDI Wallet ecosystem is technically demanding:

- You must understand **OID4VCI**, **OID4VP**, **SD-JWT VC**, **mDOC (ISO 18013-5)**, and **OAuth-based
  status protocols**.
- Libraries are scattered, often **incomplete or language-specific**.
- Hosted services can lead to **vendor lock-in** or obscure how your data is
  processed.

**EUDIPLO solves these problems** by acting as a protocol abstraction layer you
can run yourself, integrate over HTTP, and configure via JSON.

---

## Key Capabilities

| Capability                  | Description                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| 🛂 **Issuance**             | Issue credentials to users through the EUDI Wallet                                            |
| 🧾 **Presentation**         | Request credentials from users and verify them                                                |
| 🔄 **Cross-Flow Support**   | Request credentials as part of an issuance flow                                               |
| 🔐 **Secure by Default**    | Built-in support for secure key handling and OAuth-based status checking                      |
| 🧱 **Plug and Play**        | Integrates with your backend over HTTP; no requirement to use a specific programming language |
| 🖥️ **Web Client Included**  | Comes with a ready-to-use web interface for easy testing and interaction                      |
| ⚙️ **JSON Configurable**    | Set up templates, trust roots, and issuers through JSON files                                 |
| 🇪🇺 **Wallet Compatible**    | Works with multiple [wallets](./getting-started/wallet-compatibility.md)                      |
| ✅ **OIDF Conformant**      | Tested against the OpenID Foundation conformance suite for OID4VCI and OID4VP                 |
| 👥 **Multi-Tenant Support** | Isolate configurations for different tenants or clients                                       |

---

## Try EUDIPLO

=== "Standalone CLI"

    ```bash
    curl -fsSL https://eudiplo.dev/install.sh | bash
    eudiplo demo
    ```

=== "Node.js / npm"

    ```bash
    npx @eudiplo/cli demo
    ```

Both options run the same **EUDIPLO CLI**.

- **Standalone CLI**: native executable, no Node.js required.
- **npm package**: `@eudiplo/cli`, requires Node.js 22+.
- The demo requires Docker and Docker Compose, or Podman and Podman Compose.
- `eudiplo demo` creates a local demo deployment for evaluation, not production.

## What Should I Do Next?

If you are new to EUDIPLO, follow this path:

| Step | Guide                                                                                      | Goal                                                                   |
| ---- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 1    | [Quick Start](./getting-started/quick-start.md)                                            | Run the demo and confirm EUDIPLO works on your machine.                |
| 2    | [Server setup cookbook](./getting-started/cli/server-setup-cookbook.md)                    | Set up a reusable local or server instance with tenant config folders. |
| 3    | [Credential configuration](./getting-started/issuance/credential-configuration.md)         | Define what your tenant can issue.                                     |
| 4    | [Presentation configuration](./getting-started/presentation/presentation-configuration.md) | Define what your tenant can verify.                                    |

Useful references once the first setup works:

- [CLI documentation](./getting-started/cli.md)
- [Production deployment](./deployment/index.md)
- [GitHub Releases](https://github.com/openwallet-foundation/eudiplo/releases)

---

## Where Does It Fit?

Here’s how EUDIPLO fits into your infrastructure:

![EUDIPLO Overview](./overview.excalidraw.svg)

---

## 📺 Watch the Webinar

Learn more about EUDIPLO in our recorded webinar (September 17, 2025), featuring a deep dive into features, architecture, and live Q&A:

[![EUDIPLO Webinar](https://img.youtube.com/vi/GQlvHK-EFlU/0.jpg)](https://www.youtube.com/watch?v=GQlvHK-EFlU)

[Watch on YouTube](https://www.youtube.com/watch?v=GQlvHK-EFlU)

---

## 🤝 Community Call

Join our bi-weekly community call every Thursday:

[Participate via Zoom](https://zoom-lfx.platform.linuxfoundation.org/meeting/94494306854?password=0d272140-5b2b-4bd4-a8fe-0b70efe1aa86)

---

For more details on credential issuance and verification, check out:  
📘 [Configure credentials](./getting-started/issuance/index.md)  
📘 [Verify credentials](./getting-started/presentation/index.md)

---

## Who is it For?

EUDIPLO is built for:

- 🏛️ **Government services** that need to verify official documents.
- 🎓 **Universities and schools** that issue or validate diplomas.
- 🏥 **Health systems** managing patient identity or insurance.
- 🏢 **Private sector apps** that want to integrate trustable identity with
  minimal complexity.

If your organization needs to connect to the EUDI Wallet ecosystem—without
reinventing the wheel—**EUDIPLO is your gateway.**
