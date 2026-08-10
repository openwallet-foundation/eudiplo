import { ApiProperty } from "@nestjs/swagger";

export class VersionResponseDto {
    @ApiProperty({ description: "Running service version" })
    version!: string;
}
