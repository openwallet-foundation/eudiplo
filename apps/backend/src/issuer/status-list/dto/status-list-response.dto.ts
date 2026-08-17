import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { BitsPerStatus } from "@owf/token-status-list";

/**
 * DTO representing a status list entity for API responses.
 */
export class StatusListResponseDto {
    /**
     * Unique identifier for the status list.
     */
    @ApiProperty({
        description: "Unique identifier for the status list",
        example: "550e8400-e29b-41d4-a716-446655440000",
    })
    id!: string;

    /**
     * The tenant ID that owns this status list.
     */
    @ApiProperty({
        description: "The tenant ID",
        example: "root",
    })
    tenantId!: string;

    /**
     * Optional credential configuration ID that this status list is bound to.
     */
    @ApiPropertyOptional({
        description:
            "Credential configuration ID this list is bound to. Null means shared.",
        example: "org.iso.18013.5.1.mDL",
        nullable: true,
    })
    credentialConfigurationId?: string | null;

    /**
     * Optional key chain ID used for signing this status list's JWT.
     */
    @ApiPropertyOptional({
        description:
            "Key chain ID used for signing. Null means using the tenant's default.",
        example: "my-status-list-keychain",
        nullable: true,
    })
    keyChainId?: string | null;

    /**
     * The number of bits used for each status.
     */
    @ApiProperty({
        description: "Bits per status value",
        enum: [1, 2, 4, 8],
        example: 1,
    })
    bits!: BitsPerStatus;

    /**
     * Total capacity of the status list.
     */
    @ApiProperty({
        description: "Total capacity of the status list",
        example: 10000,
    })
    capacity!: number;

    /**
     * Number of entries currently in use.
     */
    @ApiProperty({
        description: "Number of entries in use",
        example: 150,
    })
    usedEntries!: number;

    /**
     * Number of available entries.
     */
    @ApiProperty({
        description: "Number of available entries",
        example: 9850,
    })
    availableEntries!: number;

    /**
     * The URI where this status list can be accessed.
     */
    @ApiProperty({
        description: "The public URI for this status list",
        example:
            "https://example.com/demo/status-management/status-list/550e8400-e29b-41d4-a716-446655440000",
    })
    uri!: string;

    /**
     * Timestamp when this status list was created.
     */
    @ApiProperty({
        description: "Creation timestamp",
        example: "2024-01-15T10:30:00.000Z",
    })
    createdAt!: Date;

    /**
     * Timestamp when the JWT for this status list expires.
     * If null, the JWT has not been generated yet.
     */
    @ApiPropertyOptional({
        description:
            "JWT expiration timestamp. Null if JWT has not been generated yet.",
        example: "2024-01-15T11:30:00.000Z",
        nullable: true,
    })
    expiresAt?: Date | null;
}
