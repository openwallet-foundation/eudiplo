import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { Role } from "../../../auth/roles/role.enum";
import { Secured } from "../../../auth/secure.decorator";
import { Token, TokenPayload } from "../../../auth/token.decorator";
import { IssuanceDto } from "./dto/issuance.dto";
import { UpdateIssuanceDto } from "./dto/update-issuance.dto";
import { IssuanceConfig } from "./entities/issuance-config.entity";
import { IssuanceService } from "./issuance.service";

@ApiTags("Issuer")
@Secured([Role.Issuances])
@Controller("issuer/config")
export class IssuanceConfigController {
    constructor(private readonly issuanceService: IssuanceService) {}

    /**
     * Returns the issuance configurations for this tenant. Creates a default one if it does not exist.
     * @returns
     */
    @Get()
    getIssuanceConfigurations(
        @Token() user: TokenPayload,
    ): Promise<IssuanceConfig> {
        return this.issuanceService
            .getIssuanceConfiguration(user.entity!.id)
            .catch(() =>
                this.issuanceService.storeIssuanceConfiguration(
                    user.entity!.id,
                    {} as IssuanceDto,
                ),
            );
    }

    /**
     * Stores the issuance configuration for this tenant.
     * @param config
     * @returns
     */
    @Post()
    storeIssuanceConfiguration(
        @Body() config: UpdateIssuanceDto,
        @Token() user: TokenPayload,
        @Req() req: Request,
    ) {
        return this.issuanceService.storeIssuanceConfiguration(
            user.entity!.id,
            config,
            user,
            req,
        );
    }
}
