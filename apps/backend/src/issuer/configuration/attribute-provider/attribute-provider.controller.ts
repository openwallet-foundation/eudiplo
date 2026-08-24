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
import { AttributeProviderService } from "./attribute-provider.service";
import { CreateAttributeProviderDto } from "./dto/create-attribute-provider.dto";
import { UpdateAttributeProviderDto } from "./dto/update-attribute-provider.dto";
import { AttributeProviderEntity } from "./entities/attribute-provider.entity";

@ApiTags("Issuer")
@Secured([Role.Issuances])
@Controller("issuer/attribute-providers")
export class AttributeProviderController {
    constructor(private readonly service: AttributeProviderService) {}

    @Get()
    @ApiOperation({ summary: "List all attribute providers" })
    @ApiResponse({
        status: 200,
        description: "List of attribute providers",
        type: [AttributeProviderEntity],
    })
    getAll(@Token() user: TokenPayload) {
        return this.service.getAll(user.entity!.id);
    }

    @Get(":id")
    @ApiOperation({ summary: "Get an attribute provider by ID" })
    @ApiResponse({
        status: 200,
        description: "The attribute provider",
        type: AttributeProviderEntity,
    })
    @ApiResponse({ status: 404, description: "Attribute provider not found" })
    getById(@Param("id") id: string, @Token() user: TokenPayload) {
        return this.service.getById(user.entity!.id, id);
    }

    @Post()
    @ApiOperation({ summary: "Create a new attribute provider" })
    @ApiResponse({
        status: 201,
        description: "Attribute provider created",
        type: AttributeProviderEntity,
    })
    @ApiBody({ type: CreateAttributeProviderDto })
    create(
        @Body() dto: CreateAttributeProviderDto,
        @Token() user: TokenPayload,
        @Req() req: Request,
    ) {
        return this.service.create(user.entity!.id, dto, user, req);
    }

    @Patch(":id")
    @ApiOperation({ summary: "Update an attribute provider" })
    @ApiResponse({
        status: 200,
        description: "Attribute provider updated",
        type: AttributeProviderEntity,
    })
    @ApiResponse({ status: 404, description: "Attribute provider not found" })
    @ApiBody({ type: UpdateAttributeProviderDto })
    update(
        @Param("id") id: string,
        @Body() dto: UpdateAttributeProviderDto,
        @Token() user: TokenPayload,
        @Req() req: Request,
    ) {
        return this.service.update(user.entity!.id, id, dto, user, req);
    }

    @Delete(":id")
    @ApiOperation({ summary: "Delete an attribute provider" })
    @ApiResponse({ status: 204, description: "Attribute provider deleted" })
    @ApiResponse({ status: 404, description: "Attribute provider not found" })
    @HttpCode(204)
    delete(
        @Param("id") id: string,
        @Token() user: TokenPayload,
        @Req() req: Request,
    ) {
        return this.service.delete(user.entity!.id, id, user, req);
    }
}
