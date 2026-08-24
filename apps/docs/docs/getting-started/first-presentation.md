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

1. Navigate to **Presentation** → **Presentation Configs** in the sidebar
2. Click **+ Create**
3. Fill in:
    - **ID**: `age-verification`
    - **Description**: `Verify age over 18`
4. Configure the DCQL query to request the credential:

    ```json
    {
        "credentials": [
            {
                "id": "pid",
                "format": "dc+sd-jwt",
                "meta": {
                    "vct_values": ["urn:eudi:pid:1"]
                },
                "claims": [
                    {
                        "path": ["age_over_18"]
                    },
                    {
                        "path": ["given_name"]
                    },
                    {
                        "path": ["family_name"]
                    }
                ]
            }
        ]
    }
    ```

5. Click **Save**

:::tip[DCQL Queries]
DCQL (Digital Credentials Query Language) lets you precisely define which credentials and claims you want to request. See [DCQL](../presentation/dcql.md) for detailed query syntax.
:::

## Step 2: Create a Presentation Request

1. Navigate to **Presentation** → **Sessions**
2. Click **+ New Request**
3. Select your presentation configuration: `age-verification`
4. Click **Create Request**
5. A **QR code** appears—scan it with your wallet that contains the credential

## Step 3: Present the Credential

1. Your wallet displays the presentation request
2. Review the requested claims
3. Approve the presentation in your wallet
4. The wallet sends the credential to EUDIPLO

## Step 4: View the Verified Claims

After the wallet presents the credential:

1. Return to the **Presentation** → **Sessions** page
2. Find your session in the list
3. Click on it to see the verified claims:

    ```json
    {
        "pid": {
            "age_over_18": true,
            "given_name": "John",
            "family_name": "Doe"
        }
    }
    ```

:::tip[Programmatic Access]
In production, you'll typically configure a [webhook](../architecture/extension-points/webhooks.md) to receive verified claims automatically. See [Handling Results](../presentation/handling-results.md) for details.
:::

## What's Next?

You've successfully verified your first credential! Continue to:

- **[Next Steps](next-steps.md)** — Explore production deployment, trust management, and advanced features
