import { webcrypto } from "node:crypto";
import { DeviceRequest } from "@owf/mdoc";
import * as x509 from "@peculiar/x509";
import { exportJWK } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { mdocContext } from "../presentations/mdoc-context.js";
import {
    buildDeviceRequestCbor,
    buildEncryptionInfo,
    buildIsoMdocDcApiTranscript,
    buildItemsRequest,
    buildReaderAuth,
} from "./cbor-request.js";

/**
 * Reader authentication for the ISO 18013-7 Annex C (DC API) flow.
 *
 * The core guarantee is byte-exactness: buildReaderAuth signs the detached
 * ReaderAuthentication payload, and the wallet-side ReaderAuth.verify() recomputes
 * that payload from the same SessionTranscript + ItemsRequest. If the two byte
 * strings diverge, verify() fails — so a passing round-trip proves the manually
 * built ReaderAuthentication CBOR matches what @owf/mdoc expects.
 */
describe("ISO 18013-7 reader authentication", () => {
    const docType = "eu.europa.ec.av.1";
    const namespaces = { [docType]: { age_over_18: false } };
    const origin = "https://verifier.example.com";
    const x = Buffer.alloc(32, 0x11).toString("base64url");
    const y = Buffer.alloc(32, 0x22).toString("base64url");
    const nonce = Buffer.alloc(16, 0x42);

    let signingJwk: Record<string, unknown>;
    let certificateChain: Uint8Array[];

    beforeAll(async () => {
        x509.cryptoProvider.set(webcrypto as Crypto);

        const keys = await webcrypto.subtle.generateKey(
            { name: "ECDSA", namedCurve: "P-256" },
            true,
            ["sign", "verify"],
        );

        const cert = await x509.X509CertificateGenerator.createSelfSigned({
            serialNumber: "01",
            name: "C=DE, CN=EUDIPLO Test Reader",
            notBefore: new Date(Date.now() - 60_000),
            notAfter: new Date(Date.now() + 3_600_000),
            signingAlgorithm: { name: "ECDSA", hash: "SHA-256" },
            keys,
        });

        signingJwk = (await exportJWK(keys.privateKey)) as Record<
            string,
            unknown
        >;
        certificateChain = [new Uint8Array(cert.rawData)];
    });

    async function buildTranscriptAndItems() {
        const encInfoB64u = buildEncryptionInfo(x, y, nonce).toString(
            "base64url",
        );
        const { sessionTranscript } = await buildIsoMdocDcApiTranscript(
            encInfoB64u,
            origin,
        );
        const itemsRequest = buildItemsRequest(docType, namespaces);
        return { sessionTranscript, itemsRequest };
    }

    it("produces a readerAuth the wallet can verify (byte-exact ReaderAuthentication)", async () => {
        const { sessionTranscript, itemsRequest } =
            await buildTranscriptAndItems();

        const readerAuth = await buildReaderAuth(
            itemsRequest,
            sessionTranscript,
            signingJwk,
            certificateChain,
        );

        // Recomputes the detached ReaderAuthentication payload internally and
        // checks the ES256 signature — resolves only on a byte-exact match.
        await expect(
            readerAuth.verify(
                { readerAuthentication: { sessionTranscript, itemsRequest } },
                mdocContext,
            ),
        ).resolves.not.toThrow();

        // ES256 in the protected header, leaf cert in the unprotected x5chain.
        expect(readerAuth.algorithm).toBeDefined();
        expect(readerAuth.certificateChain.length).toBe(1);
    });

    it("fails verification when the transcript differs (binds to the request)", async () => {
        const { sessionTranscript, itemsRequest } =
            await buildTranscriptAndItems();
        const readerAuth = await buildReaderAuth(
            itemsRequest,
            sessionTranscript,
            signingJwk,
            certificateChain,
        );

        // A transcript from a different origin must not verify.
        const otherEncInfo = buildEncryptionInfo(x, y, nonce).toString(
            "base64url",
        );
        const { sessionTranscript: otherTranscript } =
            await buildIsoMdocDcApiTranscript(
                otherEncInfo,
                "https://attacker.example",
            );

        await expect(
            readerAuth.verify(
                {
                    readerAuthentication: {
                        sessionTranscript: otherTranscript,
                        itemsRequest,
                    },
                },
                mdocContext,
            ),
        ).rejects.toThrow();
    });

    it("embeds the readerAuth in the DeviceRequest DocRequest", async () => {
        const { sessionTranscript, itemsRequest } =
            await buildTranscriptAndItems();
        const readerAuth = await buildReaderAuth(
            itemsRequest,
            sessionTranscript,
            signingJwk,
            certificateChain,
        );

        const withAuth = DeviceRequest.decode(
            new Uint8Array(buildDeviceRequestCbor(itemsRequest, readerAuth)),
        );
        expect(withAuth.docRequests[0].readerAuth).toBeDefined();

        const withoutAuth = DeviceRequest.decode(
            new Uint8Array(buildDeviceRequestCbor(itemsRequest)),
        );
        expect(withoutAuth.docRequests[0].readerAuth).toBeUndefined();
    });
});
