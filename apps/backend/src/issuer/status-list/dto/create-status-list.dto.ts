import { ApiPropertyOptional } from "@nestjs/swagger";
import { BitsPerStatus } from "@owf/token-status-list";
import { createZodDto } from "nestjs-zod";
import { CreateStatusListSchema } from "./status-list.schema";

/**
 * DTO for creating a new status list.
 */
export class CreateStatusListDto extends createZodDto(CreateStatusListSchema) {
    /**
     * Optional credential configuration ID to bind this list exclusively to.
     * If not provided, the list will be shared and available for any credential configuration.
     */
    @ApiPropertyOptional({
        description:
            "Credential configuration ID to bind this list exclusively to. Leave empty for a shared list.",
        example: "org.iso.18013.5.1.mDL",
    })
    credentialConfigurationId?: string;

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
     * Number of bits per status entry.
     * If not provided, uses the tenant's configured default or the global default.
     */
    @ApiPropertyOptional({
        description:
            "Bits per status value. More bits allow more status states. Defaults to tenant configuration.",
        enum: [1, 2, 4, 8],
        example: 1,
    })
    bits?: BitsPerStatus;

    /**
     * Maximum capacity of the status list (number of entries).
     * If not provided, uses the tenant's configured default or the global default.
     */
    @ApiPropertyOptional({
        description:
            "Maximum number of credential status entries. Defaults to tenant configuration.",
        example: 100000,
    })
    capacity?: number;
}
