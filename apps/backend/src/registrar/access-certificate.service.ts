import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CertService } from "../crypto/key/cert/cert.service";
import { KeyChainService } from "../crypto/key/key-chain.service";
import { accessCertificateControllerRegister } from "./generated";
import { RegistrarAuthService } from "./registrar-auth.service";
import type { CreateAccessCertificate } from "./schemas/registrar.schema";

/**
 * Handles creation of access certificates via the registrar API and their
 * subsequent storage in the local certificate store.
 */
@Injectable()
export class AccessCertificateService {
    private readonly logger = new Logger(AccessCertificateService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly authService: RegistrarAuthService,
        private readonly certService: CertService,
        private readonly keyChainService: KeyChainService,
    ) {}

    /**
     * Create an access certificate for a key.
     * Fetches the relying party from the registrar, registers the certificate,
     * and stores it in EUDIPLO's local certificate store.
     *
     * @param tenantId - The tenant ID
     * @param dto - The access certificate creation data
     * @returns The registrar cert ID, local cert ID, and certificate PEM
     */
    async createAccessCertificate(
        tenantId: string,
        dto: CreateAccessCertificate,
    ): Promise<{ id: string; certId: string; crt: string }> {
        const client = await this.authService.getClient(tenantId);
        const relyingPartyId =
            await this.authService.getRelyingPartyId(tenantId);

        const host = new URL(
            this.configService.getOrThrow<string>("PUBLIC_URL"),
        ).hostname;

        const publicKey = await this.keyChainService.getPublicKey(
            "pem",
            tenantId,
            dto.keyId,
        );

        const res = await accessCertificateControllerRegister({
            client,
            body: {
                publicKey,
                dns: [host],
                rpId: relyingPartyId,
            },
        });

        if (res.error) {
            this.logger.error(
                { error: res.error },
                `[${tenantId}] Failed to create access certificate`,
            );
            throw new BadRequestException(
                "Failed to create access certificate",
            );
        }

        const { id, crt } = res.data!;

        const certId = await this.certService.addCertificate(tenantId, {
            crt: [crt],
            keyId: dto.keyId,
            description: `Access certificate from registrar (ID: ${id})`,
        });

        this.logger.log(
            `[${tenantId}] Created access certificate with ID: ${id}, stored as ${certId}`,
        );

        return { id, certId, crt };
    }
}
