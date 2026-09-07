import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { TrustListService } from "../trustlist.service.js";

/**
 * Public controller for accessing trust lists
 */
@ApiTags("Issuer")
@Controller("issuers/:tenantId/trust-list/:id")
export class TrustListPublicController {
    /**
     * Creates an instance of TrustListPublicController.
     * @param trustListService
     */
    constructor(private readonly trustListService: TrustListService) {}

    /**
     * Returns the JWT of the trust list
     * @param tenantId
     * @param id
     * @returns
     */
    @Get()
    getTrustListJwt(
        @Param("tenantId") tenantId: string,
        @Param("id") id: string,
    ) {
        return this.trustListService.getJwt(tenantId, id);
    }
}
