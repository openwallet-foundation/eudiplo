import { AsnConvert } from "@peculiar/asn1-schema";
import {
    Extension as AsnExtension,
    id_ce_issuerAltName,
} from "@peculiar/asn1-x509";
import { Extension, ExtensionFactory, GeneralNames } from "@peculiar/x509";

/**
 * Tolerant replacement for @peculiar/x509's IssuerAlternativeNameExtension.
 *
 * Some real-world certificates carry a malformed issuerAltName: the extension
 * value wraps a full nested Extension structure (OID 2.5.29.18 + OCTET STRING)
 * around the GeneralNames instead of containing the GeneralNames directly.
 * A prominent example is the EU Age Verification reference-implementation
 * IACA/DS certificates ("Age Verification Issuer CA 01").
 *
 * @peculiar/x509's typed extension throws "Data does not match to GeneralName
 * ASN1 schema" while parsing it — and because `X509Certificate.extensions`
 * parses every extension, this breaks X509ChainBuilder and any
 * `cert.getExtension()` call for such certificates, making their credentials
 * unverifiable.
 *
 * This subclass parses the GeneralNames on a best-effort basis (unwrapping the
 * nested-Extension variant when present) and falls back to the raw extension
 * bytes instead of throwing.
 */
export class TolerantIssuerAlternativeNameExtension extends Extension {
    names?: GeneralNames;

    constructor(raw: BufferSource) {
        super(raw);
        this.names = TolerantIssuerAlternativeNameExtension.tryParseNames(
            this.value,
        );
        if (!this.names) {
            try {
                // Malformed variant: value = Extension { extnID, extnValue: OCTET STRING { GeneralNames } }
                const nested = AsnConvert.parse(this.value, AsnExtension);
                this.names =
                    TolerantIssuerAlternativeNameExtension.tryParseNames(
                        nested.extnValue.buffer,
                    );
            } catch {
                // Keep the raw extension without parsed names.
            }
        }
    }

    private static tryParseNames(bytes: ArrayBuffer): GeneralNames | undefined {
        try {
            return new GeneralNames(bytes);
        } catch {
            return undefined;
        }
    }
}

/**
 * Register the tolerant issuerAltName parser globally. Call once at bootstrap
 * (idempotent — re-registering simply overwrites the factory entry).
 */
export function registerTolerantX509Extensions(): void {
    ExtensionFactory.register(
        id_ce_issuerAltName,
        TolerantIssuerAlternativeNameExtension,
    );
}
