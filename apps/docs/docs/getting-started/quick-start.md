---
title: Install and Connect
sidebar_label: "1. Install and connect"
---

This is chapter 1 of the [issuance and verification cookbook](index.md). By the end, the backend and Web Client will be running, and your phone will be able to reach the backend.

## Before you start

Install Docker with Docker Compose, or Podman with Podman Compose. Start the runtime before running the commands below. The standalone `eudiplo` CLI does not require Node.js; if you use the npm package instead, install Node.js 22+ and replace `eudiplo` with `npx @eudiplo/cli`. Use an empty directory so this recipe does not replace another deployment.

## Step 1: Get an HTTPS address for the backend

A phone cannot use your computer's `localhost`: it would connect to the phone itself. Wallets also need to retrieve issuer metadata and send protocol responses to EUDIPLO.

Set up an HTTPS tunnel to local port **3000**. For example, install and authenticate the ngrok agent using its [quickstart](https://ngrok.com/docs/share-localhost/quickstart), then run:

```bash
ngrok http 3000
```

> There may be other alternatives to ngrok, such as Cloudflare Tunnel or localtunnel. Choose the one that best fits your environment. Keep in mind some free plans may have changing URLs or limited session durations.

Keep that terminal open. Copy the HTTPS forwarding URL; below, `https://YOUR-HTTPS-HOST` means that URL, without a trailing slash. A gateway error is expected until EUDIPLO starts.

Use this exact address for `PUBLIC_URL` from the beginning. Keep it unchanged through issuance and presentation: already-issued credentials can contain URLs pointing back to the issuer. If the address changes, update the deployment and issue a fresh test credential.

If you already have a reachable HTTPS backend, use that address and skip the local deployment commands. See [TLS configuration](../deployment/tls.md) for a deployment without a tunnel.

## Step 2: Initialize and start EUDIPLO

In another terminal:

```bash
mkdir eudiplo-cookbook
cd eudiplo-cookbook
eudiplo init . --target compose --preset minimal --no-demo-tenant --client --public-url https://YOUR-HTTPS-HOST --yes --start
```

Replace `https://YOUR-HTTPS-HOST` before running the command. This creates a minimal deployment using SQLite, local storage, and database-backed keys, including the Web Client. It generates a root secret rather than using the predictable credentials from `demo` mode.

The editable deployment files include `eudiplo.compose.yaml`, `.eudiplo.env`, and `config/kms.json`. Keep `.eudiplo.env` private: it contains `AUTH_CLIENT_ID`, `AUTH_CLIENT_SECRET`, and `MASTER_SECRET`.

**Expected result:** the backend listens on port `3000` and the Web Client is available at [http://localhost:4200](http://localhost:4200).

<details>
<summary>Only want to explore the UI locally?</summary>

Run `eudiplo demo` in a separate directory. This imports sample configuration and prints demo credentials. Keep that setup local; the cookbook uses the initialization command above so it can start without bundled tenants or predictable demo secrets.

</details>

## Step 3: Check both network paths

From the project directory:

```bash
eudiplo status
curl http://localhost:3000/health
curl https://YOUR-HTTPS-HOST/health
```

**Expected result:** the health response is JSON with `status` equal to `ok`. The exact health-check fields can vary.

Also open `https://YOUR-HTTPS-HOST/health` in the **phone's browser**. It must return the health response with no certificate warning, tunnel login, or HTML confirmation page. Do not proceed to QR codes until this works.

Use `http://localhost:4200` only in the browser on your computer to administer EUDIPLO. The wallet must not connect to the Web Client: it communicates only with the public backend address in `PUBLIC_URL`. Do not expose port `4200` or the Web Client through the tunnel.

## Step 4: Sign in to the Web Client

1. Open [http://localhost:4200](http://localhost:4200).
2. Set **EUDIPLO Instance** to `http://localhost:3000`.
3. Read `AUTH_CLIENT_ID` and `AUTH_CLIENT_SECRET` from the generated `.eudiplo.env` and enter them in **Client ID** and **Client Secret**.
4. Click **Login**.

**Expected result:** you are signed in as the root administrator and can manage tenants. The next chapter creates a tenant for the recipe.

## If something goes wrong

| Symptom                                | Check                                                                                                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Containers do not start                | Start Docker or Podman; check for another process already using ports 3000 or 4200. Run `eudiplo status`.                                                  |
| Local health works, phone health fails | Check the tunnel target is port 3000, the tunnel is still running, and HTTPS works without an interstitial page.                                           |
| Login fails                            | Use the generated values from `.eudiplo.env`, not `root` / `root` from demo mode.                                                                          |
| Wallet URLs contain `localhost`        | Check `PUBLIC_URL` in `.eudiplo.env`. After correcting it, recreate the backend container with the generated Compose configuration and create a new offer. |

For example, after editing the environment file:

```bash
docker compose --env-file .eudiplo.env -f eudiplo.compose.yaml up -d --force-recreate
```

To stop this deployment later, run `eudiplo down` from the project directory. Keep it running for the remaining chapters.

**Next: [Issue Your First Credential](first-credential.md).**
