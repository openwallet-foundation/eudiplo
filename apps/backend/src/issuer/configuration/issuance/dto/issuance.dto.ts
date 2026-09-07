import { OmitType } from "@nestjs/swagger";
import { IssuanceConfig } from "../entities/issuance-config.entity.js";

/**
 * DTO for mapping issuance configurations.
 */
export class IssuanceDto extends OmitType(IssuanceConfig, [
    "tenantId",
    "tenant",
    "createdAt",
    "updatedAt",
] as const) {}
