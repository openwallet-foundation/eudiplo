import { ApiProperty } from "@nestjs/swagger";
import { KmsProviderInfoDto } from "./kms-provider-capabilities.dto.js";

/**
 * Response DTO for available KMS providers.
 */
export class KmsProvidersResponseDto {
    @ApiProperty({
        description: "Detailed info for each registered KMS provider.",
        type: [KmsProviderInfoDto],
    })
    providers!: KmsProviderInfoDto[];

    @ApiProperty({
        description: "The default KMS provider name.",
        example: "db",
    })
    default!: string;
}
