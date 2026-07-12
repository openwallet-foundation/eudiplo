import { createHash } from "node:crypto";
import { cborDecode, cborEncode } from "@owf/cose";
import { describe, expect, it } from "vitest";
import {
    buildEncryptionInfo,
    buildIsoMdocDcApiTranscript,
    parseEncryptedResponse,
} from "./cbor-request";

const x = Buffer.alloc(32, 0x11).toString("base64url");
const y = Buffer.alloc(32, 0x22).toString("base64url");
const nonce = Buffer.alloc(16, 0x42);
const origin = "https://verifier.example.com";

describe("ISO 18013-7 Annex C CBOR structures", () => {
    it('builds EncryptionInfo = ["dcapi", {nonce, recipientPublicKey}]', () => {
        const encInfo = buildEncryptionInfo(x, y, nonce);
        const decoded = cborDecode(new Uint8Array(encInfo)) as [
            string,
            Map<string, unknown>,
        ];

        expect(decoded[0]).toBe("dcapi");
        expect(decoded[1]).toBeInstanceOf(Map);

        const params = decoded[1];
        const n = params.get("nonce") as Uint8Array;
        expect(n).toBeInstanceOf(Uint8Array);
        expect(Buffer.from(n)).toEqual(nonce);

        const coseKey = params.get("recipientPublicKey") as Map<
            number,
            unknown
        >;
        expect(coseKey).toBeInstanceOf(Map);
        expect(coseKey.get(1)).toBe(2); // kty = EC2
        expect(coseKey.get(-1)).toBe(1); // crv = P-256
        expect((coseKey.get(-2) as Uint8Array).length).toBe(32);
        expect((coseKey.get(-3) as Uint8Array).length).toBe(32);
    });

    it("builds SessionTranscript = [null, null, ['dcapi', SHA-256(CBOR([encInfoB64u, origin]))]]", async () => {
        const encInfoB64u = buildEncryptionInfo(x, y, nonce).toString(
            "base64url",
        );
        const { hpkeInfo, sessionTranscript } =
            await buildIsoMdocDcApiTranscript(encInfoB64u, origin);

        const decoded = cborDecode(new Uint8Array(hpkeInfo)) as [
            null,
            null,
            [string, Uint8Array],
        ];
        expect(decoded[0]).toBeNull();
        expect(decoded[1]).toBeNull();
        expect(decoded[2][0]).toBe("dcapi");

        const expectedHash = createHash("sha256")
            .update(Buffer.from(cborEncode([encInfoB64u, origin])))
            .digest();
        expect(Buffer.from(decoded[2][1])).toEqual(expectedHash);

        // HPKE info bytes must equal the encoded SessionTranscript
        expect(Buffer.from(sessionTranscript.encode())).toEqual(hpkeInfo);
    });

    it("is deterministic so the transcript can be rebuilt at response time", async () => {
        const a = buildEncryptionInfo(x, y, nonce);
        const b = buildEncryptionInfo(x, y, nonce);
        expect(a).toEqual(b);

        const ta = await buildIsoMdocDcApiTranscript(
            a.toString("base64url"),
            origin,
        );
        const tb = await buildIsoMdocDcApiTranscript(
            b.toString("base64url"),
            origin,
        );
        expect(ta.hpkeInfo).toEqual(tb.hpkeInfo);
    });

    it('parses EncryptedResponse = ["dcapi", {enc, cipherText}]', () => {
        const enc = Buffer.alloc(65, 0x04);
        const cipherText = Buffer.alloc(48, 0xaa);
        const encResp = Buffer.from(
            cborEncode([
                "dcapi",
                new Map<string, unknown>([
                    ["enc", new Uint8Array(enc)],
                    ["cipherText", new Uint8Array(cipherText)],
                ]),
            ]),
        );

        const parsed = parseEncryptedResponse(encResp);
        expect(parsed.enc).toEqual(enc);
        expect(parsed.cipherText).toEqual(cipherText);
    });

    it("rejects non-CBOR and malformed EncryptedResponse inputs", () => {
        // legacy draft format: raw enc || ciphertext concatenation
        const raw = Buffer.concat([
            Buffer.alloc(65, 0x04),
            Buffer.alloc(48, 0xaa),
        ]);
        expect(() => parseEncryptedResponse(raw)).toThrow();

        // wrong protocol tag
        const wrongTag = Buffer.from(
            cborEncode(["openid4vp", new Map([["enc", new Uint8Array(65)]])]),
        );
        expect(() => parseEncryptedResponse(wrongTag)).toThrow(/dcapi/);

        // missing cipherText
        const missing = Buffer.from(
            cborEncode(["dcapi", new Map([["enc", new Uint8Array(65)]])]),
        );
        expect(() => parseEncryptedResponse(missing)).toThrow(/cipherText/);
    });
});
