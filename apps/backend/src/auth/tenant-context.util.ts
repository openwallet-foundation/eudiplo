import { ForbiddenException } from "@nestjs/common";
import { TokenPayload } from "./token.decorator";

export function requireTenantContext(user: TokenPayload): string {
    if (!user.entity?.id) {
        throw new ForbiddenException(
            "This endpoint requires a tenant context. Use a tenant-bound account.",
        );
    }

    return user.entity.id;
}
