# Wallet Compatibility

EUDIPLO is designed to work with **EUDI-compliant wallets** that implement the
supported protocols
([OID4VCI](https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html),
[OID4VP](https://openid.net/specs/openid-4-verifiable-presentations-1_0.html),
and
[SD-JWT VC](https://www.ietf.org/archive/id/draft-ietf-oauth-selective-disclosure-jwt-08.html)).

This page provides information about tested wallets, compatibility status, and
guidance for testing new wallets with EUDIPLO.

---

## Conformance Testing

With the rapidly evolving EUDI wallet ecosystem and frequent updates across multiple wallets, it is not feasible to manually test every wallet with every EUDIPLO release. Instead, EUDIPLO ensures interoperability through **automated conformance testing**.

EUDIPLO is tested with every code change against the [OpenID Foundation Conformance Test Suite](https://openid.net/certification/about-conformance-suite/) for both **issuance (OID4VCI)** and **presentation (OID4VP)**. This ensures that EUDIPLO consistently adheres to the official specifications.

!!! success "Compatibility Guarantee"

    Any wallet that also passes the OIDF Conformance Test Suite should be compatible with EUDIPLO out of the box. If you encounter issues with a conformant wallet, please [report it](https://github.com/openwallet-foundation/eudiplo/issues/new) so we can investigate.

---

## Tested Wallets

The following wallets have been tested and verified to work with
EUDIPLO:

| Wallet                      | Provider                                                                       | Download                                                                                                                                              | Features                             |
| --------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| EU Reference Implementation | [EC](https://github.com/eu-digital-identity-wallet/eudi-app-android-wallet-ui) | [Android](https://github.com/eu-digital-identity-wallet/eudi-app-android-wallet-ui/releases)                                                          | [Details](#reference-implementation) |
| Paradym Wallet              | [Animo](https://animo.id)                                                      | [Android](https://play.google.com/store/apps/details?id=id.paradym.wallet) / [iOS](https://apps.apple.com/nl/app/paradym-wallet/id6449846111?l=en-GB) | [Details](#paradym-wallet)           |
| Multipaz                    | [Multipaz](https://multipaz.com)                                               | [Android](https://apps.multipaz.org/)                                                                                                                 | [Details](#multipaz)                 |

### Feature Support Details

#### Feature Legend

- **Issuance (OID4VCI)**
    - **Auth**: Authorization Code Flow
    - **Pre**: Pre-authorized Code Flow
    - **IAE**: Interactive Authorization Endpoint (IAE) support
    - **DPoP**: DPoP proof of possession
    - **Att**: Wallet attestation support
- **Presentation (OID4VP)**
    - **DC API**: Digital Credentials API support
- **Credential Format**
    - **SD-JWT**: SD-JWT VC support

!!! note "KISS: Keep It Simple, Stupid"

    The legend above explains the abbreviations used in the feature matrix below. If you think any other features should be tracked, please let us know!

#### Feature Matrix

| Wallet                   | Auth | Pre | IAE | DPoP | Att | DC API | SD-JWT | Mdocs |
| ------------------------ | ---- | --- | --- | ---- | --- | ------ | ------ | ----- |
| Reference Implementation | ✅   | ✅  | n/a | ✅   | ✅  | n/a    | ✅     | ✅    |
| Paradym Wallet           | ✅   | ✅  | n/a | ✅   | n/a | ✅     | ✅     | ✅    |
| Multipaz                 | ✅   | ✅  | n/a | ✅   | n/a | ✅     | ✅     | ✅    |

#### Individual Wallet Details

##### Reference Implementation

- **Version tested**: 2026.02.35-Demo
- **Last verified**: February 26, 2026
- **Notes**:
    - Forces Wallet attestation
- **Log access**: Inside the app, go to "Setting" > "Retrieve Logs"

##### Paradym Wallet

- **Version tested**: 1.16.2
- **Last verified**: January 7, 2026
- **Notes**:
    - Needs to use the same certificate for status list and signed credential. Cannot handle different `trusted_authorities` in the DCQL during presentation yet (which result in no match).
- **Log access**: Inside the app, go to "Settings" > "Export Logs"

!!! note "Help us expand this list!"

    If you have successfully tested EUDIPLO with a wallet not listed here, please [reach out to us](https://github.com/openwallet-foundation/eudiplo/issues/new?template=wallet-compatibility.md) so we can add it to this list.

##### Multipaz

- **Version tested**: 2026.W24.0-impl-verification-links-17-git-6cfc8e8
- **Last verified**: June 17, 2026
- **Notes**:
    - Using the logo for the card of a credential

---

## Testing New Wallets

EUDIPLO validates protocol interoperability automatically (OIDF conformance), but
wallet-specific behavior should still be verified manually.

The following workflow is the recommended way to test a new wallet end-to-end.

### **1. Setup a Test Environment**

1. Start EUDIPLO using the [Quick Start](./quick-start.md).
2. Complete the initial tenant and credential setup from
   [First Steps](./first-steps.md).
3. For testing with a mobile wallet, expose EUDIPLO on a public HTTPS URL and set
   `PUBLIC_URL` to that URL (for example via ngrok as described in
   [Running Locally](../development/running-locally.md)).

Minimal backend example:

```bash
docker run -d \
  --name eudiplo \
  -p 3000:3000 \
  -e PUBLIC_URL=https://your-public-host.example \
  -e MASTER_SECRET=$(openssl rand -base64 32) \
  -e AUTH_CLIENT_ID=demo \
  -e AUTH_CLIENT_SECRET=demo-secret \
  ghcr.io/openwallet-foundation-labs/eudiplo:latest
```

### **2. Prepare Wallet-Compatible Test Data**

Use a minimal, known-good configuration first:

1. Create a credential configuration from a template (for example PID SD-JWT VC).
2. Configure issuance with **DPoP disabled** for initial compatibility checks.
3. Ensure signing keys/certificates are available for the tenant.

### **3. Run Manual Issuance Checks**

At minimum, test these flows:

1. **Pre-authorized flow (required):**
    - Create an offer in **Issuance -> Sessions -> New Offer**.
    - Scan QR/deep link with the wallet.
    - Confirm credential is issued and stored in the wallet.
2. **Authorization code flow (recommended):**
    - Run an offer that requires user authentication.
    - Confirm redirect/auth step works and issuance completes.
3. **Negative checks (recommended):**
    - Retry a consumed offer and verify replay is rejected.
    - Test expired/invalid offers and verify expected error handling.

### **4. Run Manual Presentation Checks**

1. Create a presentation request from a presentation configuration.
2. Test **cross-device** flow (QR scan from another device).
3. Test **same-device** flow when supported by the wallet.
4. Verify EUDIPLO receives and validates the presentation and returns expected
   claims to the verifier.
5. Repeat with selective disclosure constraints to confirm claim filtering works.

### **5. Record Compatibility Results**

Document and share:

- Wallet name and exact version
- Device/OS version used for testing
- Which flows passed/failed (pre-auth, auth code, presentation)
- Required configuration deviations (for example DPoP on/off)
- Error messages and wallet logs

---

## Contributing Compatibility Information

### **Reporting Compatible Wallets**

If you have successfully tested a wallet with EUDIPLO:

1. **Create an Issue**: Open a
   [new issue](https://github.com/openwallet-foundation/eudiplo/issues/new)
   on GitHub
2. **Use Template**: Select the "Wallet Compatibility Report" template
3. **Provide Details**: Include wallet name, version, test results, and any
   configuration notes
4. **Screenshots**: Attach screenshots of successful flows if possible

### **Reporting Issues**

If you encounter compatibility problems:

1. **Check Known Issues**: Review the section above first
2. **Gather Information**: Collect logs, error messages, and configuration
   details
3. **Create Bug Report**: Open an issue with detailed reproduction steps
4. **Community Support**: Ask for help in our
   [Discord community](https://discord.gg/58ys8XfXDu)

---

## Version Compatibility Matrix

| EUDIPLO Version | Protocol Versions                       | Notes               |
| --------------- | --------------------------------------- | ------------------- |
| 1.x.x           | OID4VCI 1, OID4VP 1, SD-JWT VC draft-11 | Current stable      |
| Latest (main)   | Latest draft versions                   | Development version |

!!! warning "Protocol Evolution"

    EUDI wallet protocols are still evolving. Compatibility may change as new protocol versions are adopted. We track the latest specifications and update EUDIPLO accordingly.

---

## Need Help?

- 📖 **Documentation**: Check our
  [Getting Started guide](../getting-started/quick-start.md)
- 🐛 **Issues**: Report problems on
  [GitHub Issues](https://github.com/openwallet-foundation/eudiplo/issues)
- 💬 **Community**: Join our [Discord server](https://discord.gg/58ys8XfXDu)
- 📧 **Contact**: Reach out to the EUDIPLO team through GitHub discussions
