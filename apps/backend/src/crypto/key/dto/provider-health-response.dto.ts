import { ApiProperty } from "@nestjs/swagger";

export class ProviderHealthResponseDto {
    @ApiProperty({ description: "KMS provider id" })
    providerId!: string;

    @ApiProperty({ description: "KMS provider type" })
    type!: string;

    @ApiProperty({ description: "Whether the provider health check passed" })
    ok!: boolean;

    @ApiProperty({
        description: "Health check latency in milliseconds",
        required: false,
    })
    latencyMs?: number;

    @ApiProperty({
        description: "Optional health check error",
        required: false,
    })
    error?: string;
}
