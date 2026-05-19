import { OmitType } from "@nestjs/swagger";
import { TENANT_RELATION_FIELDS } from "../../../shared/utils/dto-omit-fields";
import { PresentationConfig } from "../entities/presentation-config.entity";

export class PresentationConfigCreateDto extends OmitType(PresentationConfig, [
    ...TENANT_RELATION_FIELDS,
    "createdAt",
    "updatedAt",
    "registrationCertCache",
] as const) {
    // Define the properties for the presentation config create DTO
}
