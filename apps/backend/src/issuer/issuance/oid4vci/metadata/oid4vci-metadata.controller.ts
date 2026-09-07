import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CredentialsService } from "../../../configuration/credentials/credentials.service.js";

@ApiTags("OID4VCI")
@Controller("issuers/:tenantId/credentials-metadata")
export class Oid4vciMetadataController {
    constructor(private readonly credentialsService: CredentialsService) {}

    /**
     * Retrieves the VCT (Verifiable Credential Type) from the credentials service.
     * @param id - The identifier of the credential configuration.
     */
    @Get("vct/:id")
    vct(@Param("id") id: string, @Param("tenantId") tenantId: string) {
        return this.credentialsService.getVCT(id, tenantId);
    }
}
