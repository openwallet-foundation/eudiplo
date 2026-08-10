import {
    Body,
    ConflictException,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Post,
    Put,
} from "@nestjs/common";
import { ApiResponse, ApiTags } from "@nestjs/swagger";
import { Role } from "../../auth/roles/role.enum";
import { Secured } from "../../auth/secure.decorator";
import { Token, TokenPayload } from "../../auth/token.decorator";
import { TrustListCreateDto } from "./dto/trust-list-create.dto";
import { TrustListService } from "./trustlist.service";

/**
 * Controller for managing trust lists.
 */
@Secured([Role.Issuances, Role.Presentations])
@ApiTags("Issuer")
@Controller("trust-list")
export class TrustListController {
    constructor(private readonly trustListService: TrustListService) {}

    /**
     * Creates a new trust list for the tenant
     * @param body
     * @returns
     */
    @Post()
    createTrustList(
        @Body() body: TrustListCreateDto,
        @Token() token: TokenPayload,
    ) {
        return this.trustListService
            .create(body, token.entity!)
            .catch((err) => {
                throw new ConflictException(err.message);
            });
    }

    /**
     * Returns all trust lists for the tenant
     * @param token
     * @returns
     */
    @Get()
    getAllTrustLists(@Token() token: TokenPayload) {
        return this.trustListService.findAll(token.entity!);
    }

    /**
     * Returns the trust list by id for the tenant
     * @param tenantId
     * @param id
     * @returns
     */
    @Get(":id")
    getTrustList(@Token() token: TokenPayload, @Param("id") id: string) {
        return this.trustListService.findOne(token.entity!.id, id).catch(() => {
            throw new ConflictException("Trust list not found");
        });
    }

    /**
     * Exports the trust list in LoTE format
     * @param token
     * @param id
     * @returns
     */
    @Get(":id/export")
    exportTrustList(@Token() token: TokenPayload, @Param("id") id: string) {
        return this.trustListService
            .exportTrustList(token.entity!.id, id)
            .catch(() => {
                throw new ConflictException("Trust list not found");
            });
    }

    /**
     * Returns the version history for a trust list
     * @param token
     * @param id
     * @returns
     */
    @Get(":id/versions")
    getTrustListVersions(
        @Token() token: TokenPayload,
        @Param("id") id: string,
    ) {
        return this.trustListService
            .getVersionHistory(token.entity!.id, id)
            .catch(() => {
                throw new ConflictException("Trust list not found");
            });
    }

    /**
     * Returns a specific version of a trust list
     * @param token
     * @param id
     * @param versionId
     * @returns
     */
    @Get(":id/versions/:versionId")
    getTrustListVersion(
        @Token() token: TokenPayload,
        @Param("id") id: string,
        @Param("versionId") versionId: string,
    ) {
        return this.trustListService
            .getVersion(token.entity!.id, id, versionId)
            .catch(() => {
                throw new ConflictException("Trust list version not found");
            });
    }

    /**
     * Updates a trust list with new entities
     * Creates a new version for audit and regenerates the JWT
     * @param id
     * @param body
     * @param token
     * @returns
     */
    @Put(":id")
    updateTrustList(
        @Param("id") id: string,
        @Body() body: TrustListCreateDto,
        @Token() token: TokenPayload,
    ) {
        return this.trustListService
            .update(token.entity!.id, id, body)
            .catch((err) => {
                throw new ConflictException(err.message);
            });
    }

    /**
     * Deletes a trust list
     * @param id
     * @param token
     * @returns
     */
    @Delete(":id")
    @ApiResponse({ status: 204, description: "Trust list deleted" })
    @HttpCode(204)
    deleteTrustList(@Param("id") id: string, @Token() token: TokenPayload) {
        return this.trustListService.remove(token.entity!.id, id);
    }
}
