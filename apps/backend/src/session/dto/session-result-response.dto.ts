import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { SessionStatus } from "../entities/session.entity";
import { PresentationFailureCode } from "../entities/presentation-failure-code.enum";

export class PresentationFailureDto {
    @ApiProperty({ enum: PresentationFailureCode })
    code!: PresentationFailureCode;

    @ApiPropertyOptional({
        description:
            "Optional allow-listed OAuth/OID4VP protocol error for wallet-originated errors",
    })
    protocolError?: string;
}

export class SessionResultResponseDto {
    @ApiProperty({ enum: SessionStatus })
    status!: SessionStatus;

    @ApiPropertyOptional({ type: PresentationFailureDto })
    failure?: PresentationFailureDto;

    @ApiPropertyOptional({
        type: "array",
        items: { type: "object", additionalProperties: true },
    })
    credentials?: unknown[];
}
