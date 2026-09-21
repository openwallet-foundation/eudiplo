---
title: "Cookbook: Issue and Verify a Credential"
sidebar_label: End-to-end cookbook
---

Build one complete flow: run EUDIPLO, issue a membership credential to a wallet, then request and verify its claims. Use the Web Client wizards throughout; you do not need to write an application or assemble API requests first.

## What you will build

```mermaid
flowchart LR
    A[Install and connect] --> B[Configure issuer and keys]
    B --> C[Issue membership credential]
    C --> D[Store in wallet]
    D --> E[Request name and member ID]
    E --> F[Inspect verified session]
```

| Chapter                                               | What you do                                                                        | Checkpoint                                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [1. Install and connect](quick-start.md)              | Start a minimal instance with an HTTPS address the phone can reach                 | Health endpoint works on both computer and phone                     |
| [2. Issue your first credential](first-credential.md) | Create a tenant, keys, issuer identity, and a membership credential; send an offer | Wallet contains `Membership` with `name: Max` and `member_id: M-001` |
| [3. Verify the credential](first-presentation.md)     | Request those same claims and approve their disclosure                             | A successful presentation session contains `Max` and `M-001`         |
| [4. Extend the flow](next-steps.md)                   | Add application integration and deployment-specific trust                          | Choose the next capability your application needs                    |

Follow the chapters in order. Keep the same instance, tenant, public URL, and wallet for the whole recipe.

## Recipe ingredients

- Docker with Docker Compose, or Podman with Podman Compose. The standalone `eudiplo` CLI does not require Node.js; Node.js 22+ is required only when using the npm package.
- A computer running the Web Client and a phone running a wallet with SD-JWT VC, pre-authorized issuance, and OpenID4VP support.
- A public HTTPS address forwarding to the backend, such as a development tunnel.
- Synthetic data only: this recipe uses `Max` and `M-001`.

For a starting wallet, the project's [compatibility record](../reference/wallet-compatibility.md#paradym-wallet) lists **Paradym Wallet 1.20.2**, verified on **September 21, 2026**, with issuance and presentation support. That is a historical compatibility record, not a claim that this exact recipe has been tested with every current wallet release. Check the recorded limitations and use a wallet/test environment that accepts your test issuer and verifier certificates. The wallet vendor also documents its [OpenID4VC support](https://paradym.id/articles/paradym-wallet-update).

## Shared values

| Value                      | Used for                                                              |
| -------------------------- | --------------------------------------------------------------------- |
| `membership-demo`          | Tenant ID                                                             |
| `membership`               | Credential configuration ID                                           |
| `urn:example:membership:1` | SD-JWT credential type (VCT), used for both issuance and verification |
| `name`, `member_id`        | Claim paths                                                           |
| `membership-check`         | Presentation configuration ID                                         |
| `membership`               | Credential query ID inside the presentation request                   |

The credential configuration ID identifies what EUDIPLO issues. The VCT identifies the credential type the wallet must match. The presentation configuration ID identifies the reusable verification request. They serve different purposes even when names look similar.

:::note[Scope of this recipe]
This is a learning setup with one tenant acting as both issuer and verifier. It uses test certificates and disables credential status management to keep the first flow small. Production deployments need their own certificate trust, status policy, authentication, and operational setup. See [production deployment](../deployment/production.md) before using real credentials.
:::

**Start with [Install and Connect](quick-start.md).**
