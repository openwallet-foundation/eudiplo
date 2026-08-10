import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Patch,
    Post,
    Req,
} from "@nestjs/common";
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { Role } from "../../../auth/roles/role.enum";
import { Secured } from "../../../auth/secure.decorator";
import { Token, TokenPayload } from "../../../auth/token.decorator";
import { CredentialConfigService } from "./credential-config/credential-config.service";
import { CredentialConfigCreate } from "./dto/credential-config-create.dto";
import { CredentialConfigUpdate } from "./dto/credential-config-update.dto";
import { CredentialConfig } from "./entities/credential.entity";

/**
 * Controller for managing credential configurations.
 */
@ApiTags("Issuer")
@Secured([Role.Issuances])
@Controller("issuer/credentials")
export class CredentialConfigController {
    constructor(private readonly credentialsService: CredentialConfigService) {}

    @Get()
    @ApiOperation({ summary: "List credential configurations" })
    @ApiResponse({ status: 200, type: [CredentialConfig] })
    getConfigs(@Token() user: TokenPayload) {
        return this.credentialsService.get(user.entity!.id);
    }

    @Get(":id")
    @ApiOperation({ summary: "Get a credential configuration by ID" })
    @ApiResponse({ status: 200, type: CredentialConfig })
    getConfigById(@Param("id") id: string, @Token() user: TokenPayload) {
        return this.credentialsService.getById(user.entity!.id, id);
    }

    @Post()
    @ApiOperation({ summary: "Create a credential configuration" })
    @ApiBody({ type: CredentialConfigCreate })
    @ApiResponse({ status: 201, type: CredentialConfig })
    storeCredentialConfiguration(
        @Body() config: CredentialConfigCreate,
        @Token() user: TokenPayload,
        @Req() req: Request,
    ) {
        return this.credentialsService.store(
            user.entity!.id,
            config,
            false,
            user,
            req,
        );
    }

    @Patch(":id")
    @ApiOperation({ summary: "Update a credential configuration" })
    @ApiBody({ type: CredentialConfigUpdate })
    @ApiResponse({ status: 200, type: CredentialConfig })
    updateCredentialConfiguration(
        @Param("id") id: string,
        @Body() config: CredentialConfigUpdate,
        @Token() user: TokenPayload,
        @Req() req: Request,
    ) {
        return this.credentialsService.update(
            user.entity!.id,
            id,
            config,
            user,
            req,
        );
    }

    @Delete(":id")
    @ApiOperation({ summary: "Delete a credential configuration" })
    @ApiResponse({
        status: 204,
        description: "Credential configuration deleted",
    })
    @HttpCode(204)
    deleteIssuanceConfiguration(
        @Param("id") id: string,
        @Token() user: TokenPayload,
        @Req() req: Request,
    ): Promise<unknown> {
        return this.credentialsService.delete(user.entity!.id, id, user, req);
    }
}
