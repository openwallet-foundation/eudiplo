import { ApiProperty } from "@nestjs/swagger";

export class ServiceInfoResponseDto {
    @ApiProperty({
        description: "Service name",
        example: "EUDIPLO",
    })
    service!: string;

    @ApiProperty({
        description: "Documentation URL",
        example: "https://docs.eudiplo.dev",
    })
    documentation!: string;
}
