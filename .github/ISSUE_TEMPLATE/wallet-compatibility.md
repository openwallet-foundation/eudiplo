---
name: 📱 Wallet Compatibility Report
about: Report compatibility status for a wallet with EUDIPLO
title: '[WALLET] '
labels: ['wallet-compatibility', 'community', 'needs-review']
assignees: ''
---

## 📱 Wallet Compatibility Report

### 📋 Wallet Information

**Wallet Name:** **Wallet Version:** **Platform:** (iOS/Android/Web) **Wallet
Website/Repository:** **EUDI Compliance Status:** (if known)

### 🧪 Testing Environment

**EUDIPLO Version:** **Test Date:** **Test Environment:**
(Local/Staging/Production) **Public URL Used:** **Configuration Notes:** (any
special configuration needed)

### ✅ Compatibility Status

- [ ] **Credential Issuance (OID4VCI)**
  - [ ] Authorization Code Flow
  - [ ] Pre-authorized Code Flow
  - [ ] SD-JWT VC format support
  - [ ] Proof of possession (DPoP/client attestation)

- [ ] **Credential Presentation (OID4VP)**
  - [ ] Deep link handling
  - [ ] QR code scanning
  - [ ] VP Token submission
  - [ ] Selective disclosure
  - [ ] Response mode `direct_post`

- [ ] **General Functionality**
  - [ ] HTTPS endpoint communication
  - [ ] JWT handling
  - [ ] Cryptographic operations (ES256/EdDSA)
  - [ ] Certificate validation

### 🔄 Test Results

#### Issuance Flow Test

**Status:** ✅ Success / ❌ Failed / ⚠️ Partial

**Details:**

```
Describe what happened during credential issuance testing:
- API calls made
- Wallet responses
- Final outcome
```

#### Presentation Flow Test

**Status:** ✅ Success / ❌ Failed / ⚠️ Partial

**Details:**

```
Describe what happened during credential presentation testing:
- QR code/deep link generation
- Wallet interaction
- Presentation submission
- Verification result
```

### ⚠️ Issues Encountered

**Known Issues:**

- Issue 1: Description and workaround (if any)
- Issue 2: Description and workaround (if any)

**Error Messages:**

```
Paste any relevant error messages or logs here
```

### 🔧 Configuration Requirements

**Special Configuration Needed:**

- [ ] Custom timeout values
- [ ] Specific redirect URI format
- [ ] Certificate configuration
- [ ] Other: ******\_\_\_******

### 📸 Screenshots (Optional)

If possible, attach screenshots showing:

- Successful credential issuance in wallet
- Presentation flow completion
- Any error screens encountered

### 📝 Additional Notes

Any additional information that might be helpful for other users or the EUDIPLO
team:

- Performance observations
- User experience notes
- Comparison with other wallets
- Suggestions for improvement

### 🏷️ Recommendation

Based on your testing, what would you recommend?

- [ ] **Fully Compatible** - Works without issues
- [ ] **Compatible with Configuration** - Works with specific setup
- [ ] **Partially Compatible** - Some features work, others don't
- [ ] **Not Compatible** - Does not work
- [ ] **Needs Further Testing** - Inconclusive results

### 👤 Contact Information (Optional)

**Your GitHub username:** @ **Preferred contact method:** (for follow-up
questions)

---

## For EUDIPLO Team Use

- [ ] Tested and verified by team
- [ ] Added to compatibility documentation
- [ ] Configuration documented
- [ ] Known issues documented
