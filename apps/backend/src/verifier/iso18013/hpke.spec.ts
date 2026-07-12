import { describe, expect, it } from "vitest";
import { hpkeOpen } from "./hpke";

/**
 * Official RFC 9180 test vector — Appendix A.3 (Base mode):
 * DHKEM(P-256, HKDF-SHA256), HKDF-SHA256, AES-128-GCM.
 * Source: https://github.com/cfrg/draft-irtf-cfrg-hpke/blob/master/test-vectors.json
 */
const vector = {
    info: "4f6465206f6e2061204772656369616e2055726e",
    skRm: "f3ce7fdae57e1a310d87f1ebbde6f328be0a99cdbcadf4d6589cf29de4b8ffd2",
    pkRm: "04fe8c19ce0905191ebc298a9245792531f26f0cece2460639e8bc39cb7f706a826a779b4cf969b8a0e539c7f62fb3d30ad6aa8f80e30f1d128aafd68a2ce72ea0",
    enc: "04a92719c6195d5085104f469a8b9814d5838ff72b60501e2c4466e5e67b325ac98536d7b61a1af4b78e5b7f951c0900be863c403ce65c9bfcb9382657222d18c4",
    // First encryption (sequence number 0 → nonce == base_nonce)
    aad: "436f756e742d30",
    ct: "5ad590bb8baa577f8619db35a36311226a896e7342a6d836d8b7bcd2f20b6c7f9076ac232e3ab2523f39513434",
    pt: "4265617574792069732074727574682c20747275746820626561757479",
};

function recipientJwk() {
    const pk = Buffer.from(vector.pkRm, "hex");
    return {
        x: pk.subarray(1, 33).toString("base64url"),
        y: pk.subarray(33, 65).toString("base64url"),
        d: Buffer.from(vector.skRm, "hex").toString("base64url"),
    };
}

describe("hpkeOpen (RFC 9180 A.3 official test vector)", () => {
    it("decrypts the first Base-mode encryption", () => {
        const pt = hpkeOpen(
            Buffer.from(vector.enc, "hex"),
            Buffer.from(vector.ct, "hex"),
            recipientJwk(),
            Buffer.from(vector.info, "hex"),
            Buffer.from(vector.aad, "hex"),
        );
        expect(pt.toString("hex")).toBe(vector.pt);
        expect(pt.toString()).toBe("Beauty is truth, truth beauty");
    });

    it("fails on tampered ciphertext", () => {
        const ct = Buffer.from(vector.ct, "hex");
        ct[0] ^= 0xff;
        expect(() =>
            hpkeOpen(
                Buffer.from(vector.enc, "hex"),
                ct,
                recipientJwk(),
                Buffer.from(vector.info, "hex"),
                Buffer.from(vector.aad, "hex"),
            ),
        ).toThrow();
    });

    it("fails with wrong info (transcript mismatch)", () => {
        expect(() =>
            hpkeOpen(
                Buffer.from(vector.enc, "hex"),
                Buffer.from(vector.ct, "hex"),
                recipientJwk(),
                Buffer.from("00", "hex"),
                Buffer.from(vector.aad, "hex"),
            ),
        ).toThrow();
    });
});
