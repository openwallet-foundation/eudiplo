import {
    Body,
    Controller,
    ForbiddenException,
    Post,
    Res,
} from "@nestjs/common";
import { ApiBody, ApiProduces, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { Role } from "../../../auth/roles/role.enum";
import { Secured } from "../../../auth/secure.decorator";
import { Token, TokenPayload } from "../../../auth/token.decorator";
import { ResponseType } from "../../../verifier/oid4vp/dto/presentation-request.dto";
import { FlowType, OfferRequestDto } from "../oid4vci/dto/offer-request.dto";
import { Oid4vciService } from "../oid4vci/oid4vci.service";

@ApiTags("Issuer")
@Secured([Role.IssuanceOffer])
@Controller("issuer/offer")
export class CredentialOfferController {
    constructor(private readonly oid4vciService: Oid4vciService) {}

    /**
     * Create an offer for a credential.
     * @param res
     * @param body
     */
    @ApiResponse({
        description: "JSON response",
        status: 201,
        content: {
            "application/json": {
                schema: { $ref: "#/components/schemas/OfferResponse" },
            },
            "image/png": { schema: { type: "string", format: "binary" } },
        },
    })
    @ApiProduces("application/json", "image/png")
    @ApiBody({
        type: OfferRequestDto,
        examples: {
            uri: {
                summary: "URI",
                value: {
                    response_type: ResponseType.URI,
                    credentialConfigurationIds: ["pid"],
                    flow: FlowType.PRE_AUTH_CODE,
                } as OfferRequestDto,
            },
        },
    })
    @Post()
    async getOffer(
        @Res() res: Response,
        @Body() body: OfferRequestDto,
        @Token() user: TokenPayload,
    ) {
        // Check if client has restricted issuance configs
        if (user.client?.allowedIssuanceConfigs?.length) {
            const unauthorized = body.credentialConfigurationIds.filter(
                (configId) =>
                    !user.client!.allowedIssuanceConfigs!.includes(configId),
            );
            if (unauthorized.length > 0) {
                throw new ForbiddenException(
                    `Client is not authorized to use issuance config(s): ${unauthorized.join(", ")}`,
                );
            }
        }

        // For now, we'll just pass the body to the service as before
        // You can modify the service later to accept user information if needed
        const values = await this.oid4vciService.createOffer(
            body,
            user,
            user.entity!.id,
        );

        res.send(values);
    }
}
