import { Controller, Get, Header, Headers, Param, Res } from "@nestjs/common";
import {
    ApiExtraModels,
    ApiOkResponse,
    ApiOperation,
    ApiProduces,
    ApiTags,
} from "@nestjs/swagger";
import { Response } from "express";
import { StatusListAggregationDto } from "./dto/status-list-aggregation.dto";
import { StatusListImportDto } from "./dto/status-list-import.dto";
import { StatusListService } from "./status-list.service";

@ApiExtraModels(StatusListImportDto)
@ApiTags("Issuer")
@Controller("issuers/:tenantId/status-management")
export class StatusListController {
    constructor(private readonly statusListService: StatusListService) {}

    /**
     * Get the JWT for a specific status list.
     * @param tenantId The tenant ID.
     * @param listId The status list ID.
     * @returns The status list token (JWT or CWT).
     */
    @Get("status-list/:listId")
    @ApiProduces("application/statuslist+jwt", "application/statuslist+cwt")
    async getList(
        @Res({ passthrough: true }) res: Response,
        @Param("tenantId") tenantId: string,
        @Param("listId") listId: string,
        @Headers("accept") acceptHeader?: string,
        @Headers("content-type") contentTypeHeader?: string,
    ) {
        const wantsCwt = this.prefersCwt(acceptHeader, contentTypeHeader);

        if (wantsCwt) {
            res.setHeader("Content-Type", "application/statuslist+cwt");
            const cwt = await this.statusListService.getListCwt(
                tenantId,
                listId,
            );
            res.send(Buffer.from(cwt));
            return;
        }

        res.setHeader("Content-Type", "application/statuslist+jwt");
        return this.statusListService.getListJwt(tenantId, listId);
    }

    private prefersCwt(acceptHeader?: string, contentTypeHeader?: string) {
        const headers = `${acceptHeader ?? ""},${contentTypeHeader ?? ""}`
            .toLowerCase()
            .replace(/\s+/g, "");
        return headers.includes("application/statuslist+cwt");
    }

    /**
     * Get all status list URIs for a tenant (Status List Aggregation).
     * This endpoint returns a list of all status list token URIs,
     * allowing relying parties to pre-fetch all status lists for offline validation.
     * See RFC draft-ietf-oauth-status-list Section 9.3.
     * @param tenantId The tenant ID.
     * @returns The status list aggregation response.
     */
    @Get("status-list-aggregation")
    @Header("Content-Type", "application/json")
    @ApiOperation({
        summary: "Get all status list URIs",
        description:
            "Returns a list of all status list token URIs for the tenant. " +
            "This allows relying parties to pre-fetch all status lists for offline validation. " +
            "See RFC draft-ietf-oauth-status-list Section 9.",
    })
    @ApiOkResponse({
        description: "List of status list URIs",
        type: StatusListAggregationDto,
    })
    async getStatusListAggregation(
        @Param("tenantId") tenantId: string,
    ): Promise<StatusListAggregationDto> {
        const statusLists =
            await this.statusListService.getStatusListUris(tenantId);
        return { status_lists: statusLists };
    }
}
