import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Role } from "../../roles/role.enum.js";

export class ManagedUserDto {
    @ApiProperty({ example: "5a3412a4-9ccf-41aa-b79c-f7e2a8a9b0d1" })
    id!: string;

    @ApiProperty({ example: "alice" })
    username!: string;

    @ApiProperty({ example: "alice@example.com", required: false })
    email?: string;

    @ApiProperty({ example: true })
    enabled!: boolean;

    @ApiProperty({ enum: Role, isArray: true })
    roles!: Role[];

    @ApiProperty({ example: "tenant-a", required: false })
    tenantId?: string;

    @ApiPropertyOptional({
        example: "Ab3!zK8pQ2",
        description:
            "One-time temporary password returned only on user creation.",
    })
    temporaryPassword?: string;
}
