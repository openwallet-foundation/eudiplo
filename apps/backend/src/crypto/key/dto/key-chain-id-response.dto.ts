import { ApiProperty } from "@nestjs/swagger";

export class KeyChainIdResponseDto {
    @ApiProperty({ description: "The created or imported key chain ID" })
    id!: string;
}
