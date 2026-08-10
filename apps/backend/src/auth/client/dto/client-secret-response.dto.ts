import { ApiProperty } from "@nestjs/swagger";

export class ClientSecretResponseDto {
    @ApiProperty({ description: "One-time client secret" })
    secret!: string;
}
