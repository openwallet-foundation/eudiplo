import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { ClientEntity } from "./client/entities/client.entity";
import { Role } from "./roles/role.enum";
import { TenantEntity } from "./tenant/entities/tenant.entity";

/**
 * Token decorator
 */
export const Token = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.user as TokenPayload; // Access the token payload on the request object
    },
);

/**
 * Values of the user token
 */
export interface TokenPayload {
    /**
     * Tenant entity
     */
    entity?: TenantEntity;

    /**
     * Role for the user
     */
    roles: Role[];

    /**
     * Client entity (includes resource-level restrictions)
     */
    client?: ClientEntity;

    /**
     * Token subject claim.
     */
    subject?: string;

    /**
     * Authorized party / OAuth client identifier when present.
     */
    authorizedParty?: string;
}

export interface InternalTokenPayload extends TokenPayload {
    /**
     * Tenant ID
     */
    tenant_id: string;

    /**
     * Client ID (subject of the token)
     */
    sub?: string;
}
