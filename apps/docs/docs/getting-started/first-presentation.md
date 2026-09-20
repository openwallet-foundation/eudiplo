---
title: Request Your First Presentation
---

Now that you've issued a credential, let's verify it by requesting a presentation from the wallet. This guide shows you how to create a presentation configuration and request credentials from users.

:::info[Prerequisites]

- Complete [Issue Your First Credential](first-credential.md)
- Have a wallet with at least one credential from EUDIPLO

:::

## Understanding Presentation

Credential presentation enables verifiers to:

- **Request specific credentials** from users' wallets
- **Verify authenticity** of presented credentials
- **Extract required claims** for authorization or validation
- **Maintain privacy** by requesting only necessary information

## Step 1: Create a Presentation Configuration

This walkthrough requests one claim from a credential already in your wallet.

1. Navigate to **Credential Verification** → **Verification Configs** and click **Create**.
2. In **Name**, enter:
    - **ID**: `name-verification`
    - **Description**: `Request a given name`
3. Click **Continue** to open **Credentials**.
4. Click **Import from Issuer**, enter the credential issuer URL for the credential in your wallet, and click **Fetch Credentials**.
5. Select that credential and select only its `given_name` claim. Deselect other claims, then click **Insert DCQL**. If your credential uses a different claim name, select the corresponding name claim shown by the issuer.
6. Check the selected type and claim in the visual builder, then click **Continue**.
7. In **Settings**, keep the 300-second lifetime and strict status checks. Verify that an access key chain with an active certificate is available. If the editor shows a setup reminder, complete [access key setup](../trust/key-chains.md) before testing a request. Configure a registration certificate if your wallet ecosystem requires one.
8. Click **Continue**, review the requested claim, and click **Create Configuration**.

:::tip[No JSON required for the common path]
The importer uses the issuer's actual credential type and claim paths. For a custom request, use **Add credential**. Advanced DCQL remains available through **Edit DCQL JSON**; see the [configuration guide](../presentation/presentation-configuration.md#visual-query-builder-and-json) for supported visual features.
:::

## Step 2: Create a Presentation Request

1. On the saved configuration, click **Create offer**.
2. Create the request using your new presentation configuration.
3. Scan the resulting **QR code** with the wallet containing the selected credential.

## Step 3: Present the Credential

1. Your wallet displays the presentation request
2. Review the requested claims
3. Approve the presentation in your wallet
4. The wallet sends the credential to EUDIPLO

## Step 4: View the Verified Claims

After the wallet presents the credential:

1. Return to the **Sessions** → **All Sessions** page
2. Find your session in the list
3. Click on it to see the verified claims:

    ```json
    {
        "pid": {
            "given_name": "John"
        }
    }
    ```

    The credential query ID and name value depend on the credential you selected.

:::tip[Programmatic Access]
In production, you'll typically configure a [webhook](../architecture/extension-points/webhooks.md) to receive verified claims automatically. See [Handling Results](../presentation/handling-results.md) for details.
:::

## What's Next?

You've successfully verified your first credential! Continue to:

- **[Next Steps](next-steps.md)** — Explore production deployment, trust management, and advanced features
