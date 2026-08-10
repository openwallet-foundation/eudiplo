import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BitsPerStatus } from "@owf/token-status-list";

/**
 * DTO for importing a status list configuration from a JSON file.
 * This enables "config as code" for status lists.
 */
export class StatusListImportDto {
    /**
     * Unique identifier for the status list.
     * Used to check if the list already exists and for updates.
     */
    @ApiProperty({
        description: "Unique identifier for the status list",
    })
    id!: string;

    /**
     * Optional credential configuration ID to bind this list exclusively to.
     * If not provided, the list will be shared and available for any credential configuration.
     */
    @ApiPropertyOptional({
        description:
            "Credential configuration ID to bind this list exclusively to. Leave empty for a shared list.",
        example: "org.iso.18013.5.1.mDL",
    })
    credentialConfigurationId?: string | null;

    /**
     * Optional key chain ID to use for signing this status list's JWT.
     * If not provided, uses the tenant's default StatusList key chain.
     */
    @ApiPropertyOptional({
        description:
            "Key chain ID to use for signing. Leave empty to use the tenant's default StatusList key chain.",
        example: "my-status-list-keychain",
    })
    keyChainId?: string;

    /**
     * Optional capacity of the status list (number of entries).
     * If not provided, uses the tenant's configured default or the global default.
     */
    @ApiPropertyOptional({
        description:
            "Capacity of the status list. If not provided, uses tenant or global defaults.",
        example: 10000,
        minimum: 100,
    })
    capacity?: number;

    /**
     * Optional bits per status.
     * If not provided, uses the tenant's configured default or the global default.
     */
    @ApiPropertyOptional({
        description:
            "Bits per status value. If not provided, uses tenant or global defaults.",
        enum: [1, 2, 4, 8],
        example: 1,
    })
    bits?: BitsPerStatus;
}
