import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Jwk } from "@openid4vc/oauth2";
import { JWTwithStatusListPayload } from "@owf/token-status-list";
import { digest, generateSalt } from "@sd-jwt/crypto-nodejs";
import { SDJwtVcInstance } from "@sd-jwt/sd-jwt-vc";
import { CertService } from "../../../../../crypto/key/cert/cert.service";
import { CryptoImplementationService } from "../../../../../crypto/key/crypto-implementation/crypto-implementation.service";
import { KeyUsageType } from "../../../../../crypto/key/entities/key-chain.entity";
import { KeyChainService } from "../../../../../crypto/key/key-chain.service";
import { Session } from "../../../../../session/entities/session.entity";
import { StatusListService } from "../../../../lifecycle/status/status-list.service";
import {
    CredentialConfig,
    SdJwtTrustFormat,
} from "../../entities/credential.entity";
import { buildDisclosureFrame } from "../../utils";

export interface SdJwtVcIssueOptions {
    credentialConfiguration: CredentialConfig;
    holderCnf: Jwk;
    session: Session;
    claims: Record<string, any>;
    federationEntityId?: string;
}

/**
 * Service for issuing SD-JWT VC credentials.
 */
@Injectable()
export class SdjwtvcIssuerService {
    constructor(
        private readonly certService: CertService,
        private readonly configService: ConfigService,
        private readonly statusListService: StatusListService,
        private readonly cryptoImplementationService: CryptoImplementationService,
        private readonly keyChainService: KeyChainService,
    ) {}

    /**
     * Issues an SD-JWT VC credential.
     * @param options - The issuance options (including optional federationEntityId for federation-based trust)
     * @returns The issued SD-JWT VC credential string
     */
    async issue(options: SdJwtVcIssueOptions): Promise<string> {
        const {
            credentialConfiguration,
            holderCnf,
            session,
            claims,
            federationEntityId,
        } = options;

        const certificate = await this.certService.find({
            tenantId: session.tenantId,
            type: KeyUsageType.Attestation,
            keyId: credentialConfiguration.keyChainId,
        });

        const sdjwt = new SDJwtVcInstance({
            signer: await this.keyChainService.signer(
                session.tenantId,
                certificate.keyId,
            ),
            signAlg: this.cryptoImplementationService.getAlg(),
            hasher: digest,
            hashAlg: "sha-256",
            saltGenerator: generateSalt,
            loadTypeMetadataFormat: true,
        });

        // If status management is enabled, create a status entry
        let status: JWTwithStatusListPayload | undefined;
        if (credentialConfiguration.statusManagement) {
            status = await this.statusListService.createEntry(
                session,
                credentialConfiguration.id,
            );
        }

        const iat = Math.round(Date.now() / 1000);
        // Set expiration time if lifeTime is defined
        let exp: number | undefined;
        if (credentialConfiguration.lifeTime) {
            exp = iat + credentialConfiguration.lifeTime;
        }

        // If key binding is enabled, include the JWK in the cnf
        let cnf: { jwk: Jwk } | undefined;
        if (credentialConfiguration.keyBinding) {
            cnf = {
                jwk: holderCnf,
            };
        }

        const host = this.configService.getOrThrow<string>("PUBLIC_URL");
        const disclosureFrame =
            buildDisclosureFrame(credentialConfiguration.fields as any) ?? {};

        const vct =
            typeof credentialConfiguration.vct === "string"
                ? credentialConfiguration.vct
                : `${host}/issuers/${session.tenantId}/credentials-metadata/vct/${credentialConfiguration.id}`;

        // Federation is opt-in only; default and legacy modes use x5c.
        const trustFormat =
            credentialConfiguration.sdJwtTrustFormat ?? SdJwtTrustFormat.X5C;
        const useFederation =
            trustFormat === SdJwtTrustFormat.FEDERATION &&
            Boolean(federationEntityId);

        // Build issuer identifier
        const issuer = useFederation
            ? federationEntityId
            : `${host}/issuers/${session.tenantId}`;

        // Build header: include x5c only if not using federation
        const header: any = {
            alg: this.cryptoImplementationService.getAlg(),
        };

        if (!useFederation) {
            // Include the full cert chain so verifiers can walk up to the root CA
            // trust anchor stored in the trust list (CA-pinning mode).
            header.x5c = this.certService.getCertChain(certificate);
        }

        return sdjwt.issue(
            {
                iss: issuer,
                iat,
                exp,
                vct,
                cnf,
                ...claims,
                ...status,
            },
            disclosureFrame,
            {
                header,
            },
        );
    }
}
