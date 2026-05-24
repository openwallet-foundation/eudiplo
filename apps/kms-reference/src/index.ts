/**
 * KMS Reference Implementation — Cloudflare Worker
 *
 * ⚠️  FOR DEVELOPMENT AND TESTING ONLY.
 *     Keys are stored in memory and lost on every restart.
 *     Do NOT use this in production.
 *
 * Implements the HTTP KMS adapter API contract expected by the EUDIPLO backend:
 *
 *   POST   /keys                    — Generate an ECDSA P-256 key pair
 *   POST   /keys/:kid/sign          — Sign data with a stored key
 *   POST   /keys/:kid/import        — Import a private JWK
 *   DELETE /keys/:kid               — Delete a key
 *   GET    /health                  — Health / liveness check
 *
 * Authentication (optional):
 *   Set the API_KEY variable in wrangler.jsonc (or via a .dev.vars file).
 *   When set, every request must carry the matching `x-api-key` header.
 *   Leave API_KEY empty to disable authentication during local dev.
 */

import {
    base64ToBytes,
    bytesToBase64Url,
    exportPublicJwk,
    generateEcKeyPair,
    importPrivateKey,
    signData,
    type PublicJwk,
} from "./crypto";
import { deleteKey, getKey, keyCount, storeKey } from "./key-store";

export interface Env {
    /** When non-empty, all requests must carry a matching `x-api-key` header. */
    API_KEY?: string;
}

// ============================================================================
// Helper responses
// ============================================================================

function ok(body: unknown, status = 200): Response {
    return Response.json(body, { status });
}

function badRequest(error: string): Response {
    return Response.json({ error }, { status: 400 });
}

function notFound(error = "Not Found"): Response {
    return Response.json({ error }, { status: 404 });
}

function methodNotAllowed(): Response {
    return new Response("Method Not Allowed", { status: 405 });
}

async function parseJson<T>(request: Request): Promise<T | null> {
    try {
        return (await request.json()) as T;
    } catch {
        return null;
    }
}

// ============================================================================
// Auth
// ============================================================================

function isAuthorized(request: Request, env: Env): boolean {
    if (!env.API_KEY) return true; // auth disabled
    return request.headers.get("x-api-key") === env.API_KEY;
}

// ============================================================================
// Route handlers
// ============================================================================

/** GET /health */
function handleHealth(): Response {
    return ok({ ok: true, keyCount: keyCount() });
}

/** POST /keys — generate key */
async function handleGenerateKey(request: Request): Promise<Response> {
    const body = await parseJson<{ kid?: string; alg?: string }>(request);
    if (!body) return badRequest("Invalid JSON");
    if (!body.kid) return badRequest("kid is required");

    const alg = body.alg ?? "ES256";
    if (alg !== "ES256") return badRequest(`Unsupported algorithm: ${alg}`);

    const pair = await generateEcKeyPair();
    storeKey(body.kid, pair, alg);

    const publicJwk: PublicJwk = await exportPublicJwk(pair.publicKey);
    publicJwk.kid = body.kid;
    publicJwk.alg = alg;

    console.log(`[kms-reference] Generated key: ${body.kid}`);
    return ok({ publicJwk });
}

/** POST /keys/:kid/sign */
async function handleSign(request: Request, kid: string): Promise<Response> {
    const stored = getKey(kid);
    if (!stored) return notFound(`Key not found: ${kid}`);

    const body = await parseJson<{ data?: string; alg?: string }>(request);
    if (!body) return badRequest("Invalid JSON");
    if (!body.data) return badRequest("data is required");

    let bytes: Uint8Array;
    try {
        bytes = base64ToBytes(body.data);
    } catch {
        return badRequest("data must be valid Base64");
    }

    const sigBytes = await signData(stored.pair.privateKey, bytes);
    const signature = bytesToBase64Url(sigBytes);

    console.log(`[kms-reference] Signed with key: ${kid}`);
    return ok({ signature });
}

/** POST /keys/:kid/import */
async function handleImportKey(
    request: Request,
    kid: string,
): Promise<Response> {
    const body = await parseJson<{ privateJwk?: JsonWebKey; alg?: string }>(
        request,
    );
    if (!body) return badRequest("Invalid JSON");
    if (!body.privateJwk) return badRequest("privateJwk is required");

    const alg = body.alg ?? "ES256";
    if (alg !== "ES256") return badRequest(`Unsupported algorithm: ${alg}`);

    let pair: CryptoKeyPair;
    try {
        pair = await importPrivateKey(body.privateJwk);
    } catch (err) {
        return badRequest(`Invalid privateJwk: ${String(err)}`);
    }

    storeKey(kid, pair, alg);

    const publicJwk: PublicJwk = await exportPublicJwk(pair.publicKey);
    publicJwk.kid = kid;
    publicJwk.alg = alg;

    console.log(`[kms-reference] Imported key: ${kid}`);
    return ok({ publicJwk });
}

/** DELETE /keys/:kid */
function handleDeleteKey(kid: string): Response {
    const existed = deleteKey(kid);
    console.log(`[kms-reference] Deleted key: ${kid} (existed: ${existed})`);
    return new Response(null, { status: 204 });
}

// ============================================================================
// Router
// ============================================================================

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        if (!isAuthorized(request, env)) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const url = new URL(request.url);
        const path = url.pathname;
        const method = request.method;

        // GET /health
        if (method === "GET" && path === "/health") {
            return handleHealth();
        }

        // POST /keys
        if (method === "POST" && path === "/keys") {
            return handleGenerateKey(request);
        }

        // /keys/:kid[/sign|/import]
        const match = path.match(/^\/keys\/([^/]+)(\/sign|\/import)?$/);
        if (match) {
            const kid = decodeURIComponent(match[1]);
            const sub = match[2];

            if (method === "POST" && sub === "/sign") {
                return handleSign(request, kid);
            }
            if (method === "POST" && sub === "/import") {
                return handleImportKey(request, kid);
            }
            if (method === "DELETE" && !sub) {
                return handleDeleteKey(kid);
            }

            return methodNotAllowed();
        }

        return notFound();
    },
};
