import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Put,
    Query,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Role } from "../../auth/roles/role.enum";
import { Secured } from "../../auth/secure.decorator";
import { Token, TokenPayload } from "../../auth/token.decorator";
import { KeyChainCreateDto } from "./dto/key-chain-create.dto";
import { KeyChainExportDto } from "./dto/key-chain-export.dto";
import { KeyChainImportDto } from "./dto/key-chain-import.dto";
import { KeyChainResponseDto } from "./dto/key-chain-response.dto";
import { KeyChainUpdateDto } from "./dto/key-chain-update.dto";
import { KmsProvidersResponseDto } from "./dto/kms-providers-response.dto";
import { KeyUsageType } from "./entities/key-chain.entity";
import { KeyChainService } from "./key-chain.service";

/**
 * KeyChainController manages unified key chains.
 *
 * A key chain encapsulates:
 * - An optional root CA key (for internal certificate chains)
 * - An active signing key with its certificate
 * - Rotation policy and previous keys (for grace period)
 */
@ApiTags("Key Chain")
@Secured([Role.Issuances, Role.Presentations])
@Controller("key-chain")
export class KeyChainController {
    constructor(private readonly keyChainService: KeyChainService) {}

    /**
     * Get available KMS providers and their capabilities.
     */
    @Get("providers")
    @ApiOperation({ summary: "Get available KMS providers" })
    @ApiResponse({
        status: 200,
        description: "List of available KMS providers with capabilities",
        type: KmsProvidersResponseDto,
    })
    getProviders(): KmsProvidersResponseDto {
        return this.keyChainService.getProviders();
    }

    /**
     * Liveness/readiness probe for every registered KMS provider.
     */
    @Get("providers/health")
    @ApiOperation({ summary: "Health probe for every KMS provider" })
    @ApiResponse({
        status: 200,
        description:
            "Per-provider health result (ok, latencyMs, optional error).",
    })
    getProvidersHealth() {
        return this.keyChainService.getProviderHealth();
    }

    /**
     * List all key chains for the tenant.
     */
    @Get()
    @ApiOperation({ summary: "List all key chains for the tenant" })
    @ApiResponse({
        status: 200,
        description: "List of key chains",
        type: [KeyChainResponseDto],
    })
    @ApiQuery({
        name: "usageType",
        required: false,
        enum: KeyUsageType,
        description: "Optional usage type filter",
    })
    getAll(
        @Token() token: TokenPayload,
        @Query("usageType") usageType?: KeyUsageType,
    ): Promise<KeyChainResponseDto[]> {
        return this.keyChainService.getAll(token.entity!.id, usageType);
    }

    /**
     * Get a specific key chain by ID.
     */
    @Get(":id")
    @ApiOperation({ summary: "Get a key chain by ID" })
    @ApiResponse({
        status: 200,
        description: "The key chain",
        type: KeyChainResponseDto,
    })
    @ApiResponse({ status: 404, description: "Key chain not found" })
    getById(
        @Token() token: TokenPayload,
        @Param("id") id: string,
    ): Promise<KeyChainResponseDto> {
        return this.keyChainService.getById(token.entity!.id, id);
    }

    /**
     * Export a key chain in config-import-compatible format.
     * The response includes private key material and can be saved as a JSON file
     * for provisioning via the config import mechanism.
     */
    @Get(":id/export")
    @ApiOperation({
        summary: "Export a key chain in config-import format",
        description:
            "Returns the key chain including private key material in the same format used by config import JSON files.",
    })
    @ApiResponse({
        status: 200,
        description: "Key chain export data",
        type: KeyChainExportDto,
    })
    @ApiResponse({ status: 404, description: "Key chain not found" })
    export(
        @Token() token: TokenPayload,
        @Param("id") id: string,
    ): Promise<KeyChainExportDto> {
        return this.keyChainService.export(token.entity!.id, id);
    }

    /**
     * Create a new key chain.
     */
    @Post()
    @ApiOperation({ summary: "Create a new key chain" })
    @ApiResponse({
        status: 201,
        description: "Key chain created successfully",
    })
    async create(
        @Token() token: TokenPayload,
        @Body() body: KeyChainCreateDto,
    ): Promise<{ id: string }> {
        const id = await this.keyChainService.create(token.entity!.id, body);
        return { id };
    }

    /**
     * Import an existing key chain with provided key material and optional certificate.
     */
    @Post("import")
    @ApiOperation({ summary: "Import an existing key chain" })
    @ApiResponse({
        status: 201,
        description: "Key chain imported successfully",
    })
    async import(
        @Token() token: TokenPayload,
        @Body() body: KeyChainImportDto,
    ): Promise<{ id: string }> {
        const id = await this.keyChainService.importKeyChain(
            token.entity!.id,
            body,
        );
        return { id };
    }

    /**
     * Update a key chain.
     */
    @Put(":id")
    @ApiOperation({ summary: "Update key chain metadata and rotation policy" })
    @ApiResponse({ status: 200, description: "Key chain updated successfully" })
    @ApiResponse({ status: 404, description: "Key chain not found" })
    async update(
        @Token() token: TokenPayload,
        @Param("id") id: string,
        @Body() body: KeyChainUpdateDto,
    ): Promise<void> {
        await this.keyChainService.update(token.entity!.id, id, body);
    }

    /**
     * Delete a key chain.
     */
    @Delete(":id")
    @ApiOperation({ summary: "Delete a key chain" })
    @ApiResponse({ status: 200, description: "Key chain deleted successfully" })
    @ApiResponse({ status: 404, description: "Key chain not found" })
    async delete(
        @Token() token: TokenPayload,
        @Param("id") id: string,
    ): Promise<void> {
        await this.keyChainService.delete(token.entity!.id, id);
    }

    /**
     * Manually trigger key rotation for a key chain.
     */
    @Post(":id/rotate")
    @ApiOperation({ summary: "Rotate the signing key in a key chain" })
    @ApiResponse({ status: 200, description: "Key chain rotated successfully" })
    @ApiResponse({ status: 404, description: "Key chain not found" })
    async rotate(
        @Token() token: TokenPayload,
        @Param("id") id: string,
    ): Promise<void> {
        await this.keyChainService.rotate(token.entity!.id, id);
    }
}
