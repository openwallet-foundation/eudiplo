import { ApiProperty } from "@nestjs/swagger";
import { Role } from "../roles/role.enum.js";

export class RoleDto {
    @ApiProperty({
        description: "OAuth2 roles",
        enum: Role,
        example: Role.Issuances,
    })
    role!: Role;
}
