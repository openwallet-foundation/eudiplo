import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Put,
    Req,
} from "@nestjs/common";
import {
    ApiNoContentResponse,
    ApiOkResponse,
    ApiOperation,
    ApiTags,
} from "@nestjs/swagger";
import { Request } from "express";
import { Role } from "../../auth/roles/role.enum";
import { Secured } from "../../auth/secure.decorator";
import { StatusListConfig } from "../../auth/tenant/entities/status-list-config";
import { Token, TokenPayload } from "../../auth/token.decorator";
import { UpdateStatusListConfigDto } from "./dto/update-status-list-config.dto";
import { StatusListConfigService } from "./status-list-config.service";

/**
 * Controller for managing status list configuration per tenant.
 * Note: Configuration changes only affect newly created status lists.
 * Existing status lists retain their original configuration.
 */
@ApiTags("status-list-config")
@Controller("status-list-config")
@Secured([Role.Issuances])
export class StatusListConfigController {
    constructor(
        private readonly statusListConfigService: StatusListConfigService,
    ) {}

    /**
     * Get the current status list configuration for the tenant.
     * Returns null for fields using global defaults.
     */
    @Get()
    @ApiOperation({
        summary: "Get status list configuration",
        description:
            "Returns the current status list configuration for the tenant. Fields not set use global defaults.",
    })
    @ApiOkResponse({
        description: "The status list configuration",
        type: StatusListConfig,
    })
    async getConfig(
        @Token() token: TokenPayload,
    ): Promise<StatusListConfig | null> {
        return this.statusListConfigService.getConfig(token.entity!.id);
    }

    /**
     * Update the status list configuration for the tenant.
     * Note: Changes only affect newly created status lists.
     */
    @Put()
    @ApiOperation({
        summary: "Update status list configuration",
        description:
            "Update the status list configuration. Changes only affect newly created status lists. Set a field to null to reset to global default.",
    })
    @ApiOkResponse({
        description: "The updated status list configuration",
        type: StatusListConfig,
    })
    async updateConfig(
        @Token() token: TokenPayload,
        @Body() config: UpdateStatusListConfigDto,
        @Req() req: Request,
    ): Promise<StatusListConfig> {
        return this.statusListConfigService.updateConfig(
            token.entity!.id,
            config,
            token,
            req,
        );
    }

    /**
     * Reset the status list configuration to global defaults.
     * Note: This only affects newly created status lists.
     */
    @Delete()
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: "Reset status list configuration",
        description:
            "Reset the status list configuration to global defaults. Only affects newly created status lists.",
    })
    @ApiNoContentResponse({
        description: "Configuration reset successfully",
    })
    async resetConfig(
        @Token() token: TokenPayload,
        @Req() req: Request,
    ): Promise<void> {
        return this.statusListConfigService.resetConfig(
            token.entity!.id,
            token,
            req,
        );
    }
}
