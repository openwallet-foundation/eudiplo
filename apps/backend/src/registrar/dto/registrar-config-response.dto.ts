import { ApiProperty, OmitType } from "@nestjs/swagger";
import { RegistrarConfigEntity } from "../entities/registrar-config.entity.js";

/**
 * DTO for the registrar configuration response.
 * Excludes the password field for security and includes a flag indicating if a password is set.
 */
export class RegistrarConfigResponseDto extends OmitType(
    RegistrarConfigEntity,
    ["tenant", "tenantId", "password"] as const,
) {
    /**
     * Indicates whether a password is configured.
     * The actual password is never returned for security reasons.
     */
    @ApiProperty({
        description:
            "Indicates whether a password is configured (actual password is never returned)",
        example: true,
    })
    hasPassword!: boolean;

    /**
     * Create a response DTO from an entity.
     * @param entity - The registrar config entity
     * @returns The response DTO with password masked
     */
    static fromEntity(
        entity: RegistrarConfigEntity,
    ): RegistrarConfigResponseDto {
        const dto = new RegistrarConfigResponseDto();
        dto.registrarUrl = entity.registrarUrl;
        dto.oidcUrl = entity.oidcUrl;
        dto.clientId = entity.clientId;
        dto.clientSecret = entity.clientSecret;
        dto.username = entity.username;
        dto.registrationCertificateDefaults =
            entity.registrationCertificateDefaults;
        dto.hasPassword = !!entity.password;
        return dto;
    }
}
