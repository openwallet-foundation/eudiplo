import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
} from "@nestjs/common";
import type { Request } from "express";
import { from, mergeMap, type Observable, switchMap } from "rxjs";
import type { TokenPayload } from "../../auth/token.decorator";
import { ConfigOwnershipService } from "./config-ownership.service";
import { ConfigResourceRouteService } from "./config-resource-route.service";

@Injectable()
export class ConfigGenerationInterceptor implements NestInterceptor {
    constructor(
        private readonly ownershipService: ConfigOwnershipService,
        private readonly routeService: ConfigResourceRouteService,
    ) {}

    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<unknown> {
        const request = context
            .switchToHttp()
            .getRequest<Request & { user?: TokenPayload }>();
        if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
            return next.handle();
        }
        const match = this.routeService.match(
            request.method,
            request.path,
            request.body as Record<string, unknown>,
        );
        const tenantId = match?.tenantId ?? request.user?.entity?.id;
        if (!tenantId || !match) return next.handle();

        // Global guards run before controller authentication guards, so the
        // authenticated tenant is only guaranteed to be available here. Keep
        // the ownership check and generation update in the same interceptor to
        // prevent file-managed resources from being changed through the API.
        return from(
            this.ownershipService.assertMutable(tenantId, match.kind, match.id),
        ).pipe(
            switchMap(() => next.handle()),
            mergeMap(async (result) => {
                if (request.method === "DELETE") {
                    if (match.kind === "Tenant") {
                        await this.ownershipService.removeTenant(tenantId);
                    } else {
                        await this.ownershipService.remove(
                            tenantId,
                            match.kind,
                            match.id,
                        );
                    }
                } else {
                    await this.ownershipService.recordApiMutation(
                        tenantId,
                        match.kind,
                        match.id,
                        match.create,
                    );
                }
                return result;
            }),
        );
    }
}
