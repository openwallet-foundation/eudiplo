import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { decodeJwt } from "jose";
import { LessThan, Repository } from "typeorm";
import { v4 } from "uuid";
import { AuditLogContext } from "../../../session/logging/session-audit.service";
import { SessionLoggerService } from "../../../session/logging/session-logger.service";
import { NonceEntity } from "./entities/nonces.entity";
import { CredentialRequestException } from "./exceptions";

type SupportedCredentialProofType = "jwt" | "attestation";

/** Owns the complete lifecycle of OID4VCI proof nonces. */
@Injectable()
export class NonceService {
    constructor(
        @InjectRepository(NonceEntity)
        private readonly nonceRepository: Repository<NonceEntity>,
        private readonly auditLogger: SessionLoggerService,
    ) {}

    async issue(tenantId: string): Promise<string> {
        const nonce = v4();
        await this.nonceRepository.save({
            nonce,
            tenantId,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });
        return nonce;
    }

    @Cron(CronExpression.EVERY_10_MINUTES)
    cleanup(): void {
        void this.nonceRepository.delete({
            expiresAt: LessThan(new Date()),
        });
    }

    /**
     * Validates all proof nonces and consumes them before credential issuance.
     * A nonce is tenant-scoped, time-limited, and single-use.
     */
    async validateAndConsume(
        proofs: string[],
        proofType: SupportedCredentialProofType,
        tenantId: string,
        logContext: AuditLogContext,
        credentialConfigurationId: string,
    ): Promise<void> {
        const uniqueNonces = new Set<string>();
        for (const proofValue of proofs) {
            const payload = decodeJwt(proofValue);
            if (!payload.nonce) {
                throw new CredentialRequestException(
                    "invalid_proof",
                    `All ${proofType} key proofs must contain a nonce when the nonce endpoint is offered`,
                );
            }
            uniqueNonces.add(payload.nonce as string);
        }

        for (const nonce of uniqueNonces) {
            const nonceEntity = await this.nonceRepository.findOne({
                where: { nonce, tenantId },
            });

            if (!nonceEntity) {
                this.throwNonceError(
                    "The nonce in the key proof is invalid or has already been used",
                    logContext,
                    credentialConfigurationId,
                );
            }

            if (nonceEntity.expiresAt < new Date()) {
                await this.nonceRepository.delete({ nonce, tenantId });
                this.throwNonceError(
                    "The nonce in the key proof has expired",
                    logContext,
                    credentialConfigurationId,
                );
            }

            await this.nonceRepository.delete({ nonce, tenantId });
        }
    }

    private throwNonceError(
        message: string,
        logContext: AuditLogContext,
        credentialConfigurationId: string,
    ): never {
        const error = new CredentialRequestException("invalid_nonce", message);
        this.auditLogger.logFlowError(logContext, error, {
            credentialConfigurationId,
        });
        throw error;
    }
}
