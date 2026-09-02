import { createHmac, hkdfSync } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
    ENCRYPTION_KEY_PROVIDER,
    type EncryptionKeyProvider,
} from "../../platform/data-encryption/providers/encryption-key-provider.interface";

/**
 * Derives the pseudonymous subject keys used by the active-credential-limit
 * policy (issue #843).
 *
 * The subject key is an HMAC-SHA256 over the authorization identity
 * (`iss` + `sub`), scoped to a tenant and credential configuration. It lets
 * EUDIPLO recognise a returning subject without ever persisting their raw
 * identity.
 *
 * Key handling:
 * - The HMAC key is derived with HKDF from the root key already used for
 *   at-rest encryption, obtained through the existing
 *   {@link ENCRYPTION_KEY_PROVIDER} (env / Vault / AWS / Azure depending on
 *   deployment). A distinct HKDF `info` string keeps it cryptographically
 *   independent from the encryption key itself.
 * - It is derived once per process and held only in memory; it is never
 *   written to the database.
 *
 * Correlation resistance: `credentialConfigurationId` is part of the HMAC
 * input, so the same person yields different subject keys for different
 * credential types. Slots for a PID and a diploma cannot be linked through the
 * stored value.
 */
@Injectable()
export class SubjectKeyService {
    private static readonly HKDF_INFO = "eudiplo-active-credential-subject-key";
    private static readonly ISSUANCE_SET_HKDF_INFO =
        "eudiplo-active-credential-issuance-set";
    private static readonly HKDF_KEY_LENGTH = 32;

    private hmacKey: Buffer | null = null;
    private hmacKeyPromise: Promise<Buffer> | null = null;
    private issuanceSetHmacKey: Buffer | null = null;
    private issuanceSetHmacKeyPromise: Promise<Buffer> | null = null;
    private readonly logger = new Logger(SubjectKeyService.name);

    constructor(
        @Inject(ENCRYPTION_KEY_PROVIDER)
        private readonly keyProvider: EncryptionKeyProvider,
    ) {}

    /**
     * Derive the pseudonymous subject key for an authorization identity.
     *
     * @param params.tenantId Tenant the credential is issued under.
     * @param params.credentialConfigurationId Credential configuration being
     *   issued; scoping to this prevents cross-credential correlation.
     * @param params.iss Authorization server issuer (`iss` claim).
     * @param params.sub Subject identifier (`sub` claim). Callers must ensure
     *   this is durable per user for the flow in use — a session-scoped `sub`
     *   would make every issuance look like a new subject.
     * @returns Hex-encoded HMAC-SHA256 digest, safe to persist.
     */
    async deriveSubjectKey(params: {
        tenantId: string;
        credentialConfigurationId: string;
        iss: string;
        sub: string;
    }): Promise<string> {
        const key = await this.getHmacKey();
        const message = [
            params.tenantId,
            params.credentialConfigurationId,
            params.iss,
            params.sub,
        ].join("|");

        return createHmac("sha256", key).update(message).digest("hex");
    }

    /**
     * Derive an opaque identifier for all credential requests authorized by the
     * same access token. This is separate from the subject key so a stored
     * issuance set cannot be used to test candidate tokens with the subject-key
     * HMAC secret.
     */
    async deriveIssuanceSetId(accessToken: string): Promise<string> {
        const key = await this.getIssuanceSetHmacKey();
        return createHmac("sha256", key).update(accessToken).digest("hex");
    }

    /**
     * Lazily derive and cache the HMAC key for this process.
     */
    private async getHmacKey(): Promise<Buffer> {
        if (this.hmacKey) {
            return this.hmacKey;
        }

        this.hmacKeyPromise ??= this.deriveHmacKey();

        this.hmacKey = await this.hmacKeyPromise;
        return this.hmacKey;
    }

    private async deriveHmacKey(): Promise<Buffer> {
        return this.deriveKey(SubjectKeyService.HKDF_INFO);
    }

    private async getIssuanceSetHmacKey(): Promise<Buffer> {
        if (this.issuanceSetHmacKey) {
            return this.issuanceSetHmacKey;
        }

        this.issuanceSetHmacKeyPromise ??= this.deriveKey(
            SubjectKeyService.ISSUANCE_SET_HKDF_INFO,
        );

        this.issuanceSetHmacKey = await this.issuanceSetHmacKeyPromise;
        return this.issuanceSetHmacKey;
    }

    private async deriveKey(info: string): Promise<Buffer> {
        this.logger.log(
            `Deriving subject-key HMAC secret via provider: ${this.keyProvider.name}`,
        );

        const rootKey = await this.keyProvider.getKey();

        return Buffer.from(
            hkdfSync(
                "sha256",
                rootKey,
                "",
                info,
                SubjectKeyService.HKDF_KEY_LENGTH,
            ),
        );
    }
}
