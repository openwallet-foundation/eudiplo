import { applyDecorators, UseGuards } from "@nestjs/common";
import { ApiSecurity } from "@nestjs/swagger";
import { JwtAuthGuard } from "./auth.guard.js";
import { Role } from "./roles/role.enum.js";
import { Roles } from "./roles/roles.decorator.js";
import { RolesGuard } from "./roles/roles.guard.js";

export function Secured(roles: Role[]) {
    return applyDecorators(
        Roles(...roles),
        UseGuards(JwtAuthGuard, RolesGuard),
        ApiSecurity("oauth2", roles),
    );
}
