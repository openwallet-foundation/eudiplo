import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { KeyChainEntity } from "./entities/key-chain.entity.js";
import { KeyChainService } from "./key-chain.service.js";

/**
 * Service responsible for automatic key rotation.
 *
 * Key chains with rotationEnabled=true are checked periodically.
 * When lastRotatedAt + rotationIntervalDays has passed, the key is rotated:
 * 1. New key material is generated
 * 2. A new certificate is generated (signed by root CA if internal chain)
 * 3. Previous key is preserved for grace period
 */
@Injectable()
export class KeyRotationService {
    private readonly logger = new Logger(KeyRotationService.name);

    constructor(
        @InjectRepository(KeyChainEntity)
        private readonly keyChainRepository: Repository<KeyChainEntity>,
        private readonly keyChainService: KeyChainService,
    ) {}

    /**
     * Cron job that runs daily to check for keys that need rotation.
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async checkForRotation(): Promise<void> {
        this.logger.log("Checking for key chains that need rotation...");

        try {
            const keyChains = await this.findKeyChainNeedingRotation();

            if (keyChains.length === 0) {
                this.logger.log("No key chains need rotation.");
                return;
            }

            this.logger.log(
                `Found ${keyChains.length} key chain(s) that need rotation.`,
            );

            for (const keyChain of keyChains) {
                try {
                    await this.keyChainService.rotate(
                        keyChain.tenantId,
                        keyChain.id,
                    );
                    this.logger.log(
                        `Successfully rotated key chain ${keyChain.id} for tenant ${keyChain.tenantId}`,
                    );
                } catch (error) {
                    this.logger.error(
                        `Failed to rotate key chain ${keyChain.id} for tenant ${keyChain.tenantId}: ${error}`,
                    );
                }
            }
        } catch (error) {
            this.logger.error(`Key rotation check failed: ${error}`);
        }
    }

    /**
     * Find all key chains that have rotation enabled and are due for rotation.
     */
    private async findKeyChainNeedingRotation(): Promise<KeyChainEntity[]> {
        const now = new Date();

        // Get all key chains with rotation enabled
        const keyChains = await this.keyChainRepository.find({
            where: {
                rotationEnabled: true,
            },
        });

        // Filter key chains that need rotation
        return keyChains.filter((keyChain) => {
            if (!keyChain.rotationIntervalDays) {
                return false;
            }

            // If never rotated, check against creation date
            const lastRotation = keyChain.lastRotatedAt || keyChain.createdAt;
            const rotationDue = new Date(lastRotation);
            rotationDue.setDate(
                rotationDue.getDate() + keyChain.rotationIntervalDays,
            );

            return now >= rotationDue;
        });
    }

    /**
     * Manually trigger rotation for a specific key chain.
     * @param tenantId - The tenant ID
     * @param keyChainId - The key chain ID to rotate
     */
    async rotateKeyChain(tenantId: string, keyChainId: string): Promise<void> {
        await this.keyChainService.rotate(tenantId, keyChainId);
    }
}
