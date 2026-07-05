import {
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { KmsConfigDto } from "../dto/kms-config.dto";
import { KmsProviderRegistry } from "./kms-provider.registry";
import { KmsConfigService } from "./kms-config.service";

@Injectable()
export class KmsTenantConfigService {
    constructor(
        private readonly configService: ConfigService,
        private readonly kmsConfigService: KmsConfigService,
        private readonly kmsProviderRegistry: KmsProviderRegistry,
    ) {}

    getTenantConfig(tenantId: string): KmsConfigDto | null {
        const path = this.getTenantConfigPath(tenantId);
        if (!path || !existsSync(path)) {
            return null;
        }
        return JSON.parse(readFileSync(path, "utf8")) as KmsConfigDto;
    }

    getEffectiveConfig(tenantId: string): KmsConfigDto {
        return this.kmsConfigService.getConfig(tenantId);
    }

    saveTenantConfig(tenantId: string, config: KmsConfigDto): KmsConfigDto {
        const path = this.getTenantConfigPath(tenantId);
        if (!path) {
            throw new NotFoundException("CONFIG_FOLDER is not configured");
        }

        const validatedConfig = this.validateConfig(config);

        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(
            path,
            `${JSON.stringify(validatedConfig, null, 4)}\n`,
            "utf8",
        );

        this.refreshTenantConfig(tenantId);
        return this.getEffectiveConfig(tenantId);
    }

    deleteTenantConfig(tenantId: string): void {
        const path = this.getTenantConfigPath(tenantId);
        if (path && existsSync(path)) {
            rmSync(path);
        }

        this.refreshTenantConfig(tenantId);
    }

    private refreshTenantConfig(tenantId: string): void {
        this.kmsConfigService.invalidateTenantCache(tenantId);
        this.kmsProviderRegistry.invalidateTenant(tenantId);
    }

    private getTenantConfigPath(tenantId: string): string | null {
        const configFolder = this.configService.get<string>("CONFIG_FOLDER");
        if (!configFolder) {
            return null;
        }
        return join(configFolder, tenantId, "kms.json");
    }

    private validateConfig(config: KmsConfigDto): KmsConfigDto {
        const dto = plainToInstance(KmsConfigDto, config);
        const errors = validateSync(dto, {
            whitelist: true,
            forbidNonWhitelisted: true,
            stopAtFirstError: false,
        });

        if (errors.length > 0) {
            throw new BadRequestException({
                message: "Invalid KMS configuration",
                errors,
            });
        }

        return dto;
    }
}
