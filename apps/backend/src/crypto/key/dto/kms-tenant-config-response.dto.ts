import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { KmsConfigDto } from "./kms-config.dto";
import type { KmsConfig } from "../schemas/kms-config.schema";

export class KmsTenantConfigResponseDto {
    @ApiPropertyOptional({
        description:
            "Tenant-specific KMS configuration from <CONFIG_FOLDER>/<tenantId>/kms.json. Null when no tenant file exists.",
        type: KmsConfigDto,
    })
    tenantConfig?: KmsConfig | null;

    @ApiProperty({
        description:
            "Effective configuration used at runtime for the tenant (global + tenant merge).",
        type: KmsConfigDto,
    })
    effectiveConfig!: KmsConfig;
}
