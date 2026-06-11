import {
    Body,
    Controller,
    ForbiddenException,
    Post,
    Req,
    Res,
} from "@nestjs/common";
import { ApiBody, ApiProduces, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { Role } from "../../auth/roles/role.enum";
import { Secured } from "../../auth/secure.decorator";
import { Token, TokenPayload } from "../../auth/token.decorator";
import { OfferResponse } from "../../issuer/issuance/oid4vci/dto/offer-request.dto";
import {
    PresentationRequest,
    ResponseType,
} from "../oid4vp/dto/presentation-request.dto";
import { Oid4vpService } from "../oid4vp/oid4vp.service";

@ApiTags("Verifier")
@Secured([Role.PresentationRequest, Role.Presentations])
@Controller("verifier/offer")
export class VerifierOfferController {
    /**
     * Constructor for the Oid4vpController.
     * @param oid4vpService - Instance of Oid4vpService for handling OID4VP operations.
     */
    constructor(private readonly oid4vpService: Oid4vpService) {}

    /**
     * Create an presentation request that can be sent to the user
     * @param res
     * @param body
     */
    @ApiResponse({
        description: "JSON response",
        status: 201,
        //TODO: do not use type, otherwhise the response can not deal with both JSON and PNG.
        type: OfferResponse,
        content: {
            "application/json": { schema: { type: "object" } },
            "image/png": { schema: { type: "string", format: "binary" } },
        },
    })
    @ApiProduces("application/json", "image/png")
    @ApiBody({
        type: PresentationRequest,
        examples: {
            uri: {
                summary: "URI",
                value: {
                    response_type: ResponseType.URI,
                    requestId: "pid",
                },
            },
            "dc-api": {
                summary: "DC API",
                value: {
                    response_type: ResponseType.DC_API,
                    requestId: "pid",
                    expected_origin: "http://localhost:8080",
                },
            },
        },
    })
    @Post()
    async getOffer(
        @Req() req: Request,
        @Res() res: Response,
        @Body() body: PresentationRequest,
        @Token() user: TokenPayload,
    ) {
        // Check resource-level authorization
        if (user.client?.allowedPresentationConfigs?.length) {
            if (
                !user.client.allowedPresentationConfigs.includes(body.requestId)
            ) {
                throw new ForbiddenException(
                    `Client is not authorized to use presentation config: ${body.requestId}`,
                );
            }
        }

        const values = await this.oid4vpService.createRequest(
            body.requestId,
            {
                webhook: body.webhook,
                redirectUri: body.redirectUri,
                transaction_data: body.transaction_data,
            },
            user.entity!.id,
            body.response_type === ResponseType.DC_API,
            body.expected_origin ?? req.get("origin") ?? req.get("host") ?? "",
        );
        values.uri = `openid4vp://?${values.uri}`;
        values.crossDeviceUri = `openid4vp://?${values.crossDeviceUri}`;
        res.status(201).json(values);
    }
}
