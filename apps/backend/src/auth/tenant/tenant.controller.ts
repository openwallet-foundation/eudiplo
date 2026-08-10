import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Req,
    HttpCode,
} from "@nestjs/common";
import {
    ApiBody,
    ApiExtraModels,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from "@nestjs/swagger";
import { Request } from "express";
import { Role } from "../roles/role.enum";
import { Secured } from "../secure.decorator";
import { Token, TokenPayload } from "../token.decorator";
import { ImportTenantDto } from "./dto/import-tenant.dto";
import { TenantService } from "./tenant.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import {
    TenantCreateResponseDto,
    TenantResponseDto,
} from "./dto/tenant-response.dto";

/**
 * Tenant management controller
 */
@ApiExtraModels(ImportTenantDto)
@ApiTags("Tenant")
@Secured([Role.Tenants])
@Controller("tenant")
export class TenantController {
    constructor(private readonly tenantService: TenantService) {}

    /**
     * Get all tenants
     * @returns
     */
    @ApiOperation({ summary: "Get all tenants" })
    @ApiResponse({ status: 200, type: [TenantResponseDto] })
    @Get()
    getTenants(): Promise<TenantResponseDto[]> {
        return this.tenantService.getAll();
    }

    /**
     * Initialize a tenant
     * @param data
     * @returns
     */
    @ApiOperation({ summary: "Initialize a tenant" })
    @ApiBody({ type: CreateTenantDto })
    @ApiResponse({ status: 201, type: TenantCreateResponseDto })
    @Post()
    initTenant(
        @Body() data: CreateTenantDto,
        @Token() token: TokenPayload,
        @Req() req: Request,
    ) {
        return this.tenantService.createTenant(data, token, req);
    }

    /**
     * Get a tenant by ID
     * @param id The ID of the tenant
     * @returns The tenant
     */
    @ApiOperation({ summary: "Get a tenant by ID" })
    @ApiResponse({ status: 200, type: TenantResponseDto })
    @Get(":id")
    getTenant(@Param("id") id: string): Promise<TenantResponseDto> {
        return this.tenantService.getTenant(id);
    }

    /**
     * Update a tenant by ID
     * @param id The ID of the tenant
     * @param data The updated tenant data
     * @returns The updated tenant
     */
    @ApiOperation({ summary: "Update a tenant by ID" })
    @ApiBody({ type: UpdateTenantDto })
    @ApiResponse({ status: 200, type: TenantResponseDto })
    @Patch(":id")
    updateTenant(
        @Param("id") id: string,
        @Body() data: UpdateTenantDto,
        @Token() token: TokenPayload,
        @Req() req: Request,
    ) {
        return this.tenantService.updateTenant(id, data, token, req);
    }

    /**
     * Deletes a tenant by ID
     * @param id The ID of the tenant to delete
     */
    @ApiOperation({ summary: "Delete a tenant by ID" })
    @ApiResponse({ status: 204, description: "Tenant deleted" })
    @Delete(":id")
    @HttpCode(204)
    deleteTenant(
        @Param("id") id: string,
        @Token() token: TokenPayload,
        @Req() req: Request,
    ) {
        return this.tenantService.deleteTenant(id, token, req);
    }
}
