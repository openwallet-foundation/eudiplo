import {
    Body,
    Controller,
    Header,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Req,
    Res,
} from "@nestjs/common";
import { ApiParam, ApiTags } from "@nestjs/swagger";
import type {
    CreateCredentialResponseReturn,
    CredentialResponse,
    DeferredCredentialResponse,
} from "@openid4vc/openid4vci";
import type { Request, Response } from "express";
import { DeferredCredentialRequestDto } from "./dto/deferred-credential-request.dto";
import { NotificationRequestDto } from "./dto/notification-request.dto";
import { CredentialRequestException } from "./exceptions";
import { Oid4vciService } from "./oid4vci.service";

/**
 * Controller for handling OID4VCI (OpenID for Verifiable Credential Issuance) requests.
 */
@ApiTags("OID4VCI")
@ApiParam({ name: "tenantId", required: true })
@Controller("issuers/:tenantId/vci")
export class Oid4vciController {
    constructor(private readonly oid4vciService: Oid4vciService) {}

    /**
     * Endpoint to issue credentials
     * @param req
     * @param res
     * @param tenantId
     * @returns
     */
    @Post("credential")
    @HttpCode(HttpStatus.OK)
    async credential(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @Param("tenantId") tenantId: string,
    ): Promise<CredentialResponse | DeferredCredentialResponse | string> {
        return this.oid4vciService.getCredential(req, tenantId).then(
            (result) => {
                // Check if this is a deferred response (has non-null transaction_id)
                if ("transaction_id" in result && result.transaction_id) {
                    res.status(HttpStatus.ACCEPTED);
                    return result;
                }

                const credentialResult =
                    result as CreateCredentialResponseReturn;

                // If the response is encrypted, return the JWE string directly
                // See: https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#name-credential-response
                if (credentialResult.credentialResponseJwt) {
                    res.setHeader("Content-Type", "application/jwt");
                    return credentialResult.credentialResponseJwt;
                }

                return credentialResult.credentialResponse;
            },
            (err) => {
                console.log(err);
                // Re-throw if already a spec-compliant CredentialRequestException
                if (err instanceof CredentialRequestException) {
                    throw err;
                }
                // Wrap other errors according to OID4VCI spec Section 8.3.1.2
                throw new CredentialRequestException(
                    "invalid_credential_request",
                    err.message,
                );
            },
        );
    }

    /**
     * Deferred Credential Endpoint
     *
     * According to OID4VCI Section 9, this endpoint is used by the wallet to poll
     * for credentials that were not immediately available.
     *
     * @param req The request
     * @param body The deferred credential request containing transaction_id
     * @param tenantId The tenant ID
     * @returns The credential response if ready, or issuance_pending error
     */
    @Post("deferred_credential")
    @HttpCode(HttpStatus.OK)
    deferredCredential(
        @Req() req: Request,
        @Body() body: DeferredCredentialRequestDto,
        @Param("tenantId") tenantId: string,
    ): Promise<CredentialResponse> {
        return this.oid4vciService.getDeferredCredential(req, body, tenantId);
    }

    /**
     * Notification endpoint
     * @param body
     * @returns
     */
    @Post("notification")
    notifications(
        @Body() body: NotificationRequestDto,
        @Req() req: Request,
        @Param("tenantId") tenantId: string,
    ) {
        return this.oid4vciService.handleNotification(req, body, tenantId);
    }

    @Post("nonce")
    @HttpCode(HttpStatus.OK)
    @Header("Cache-Control", "no-store")
    nonce(@Param("tenantId") tenantId: string) {
        //TODO: maybe also add it into the header, see https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#name-nonce-response
        return this.oid4vciService.nonceRequest(tenantId).then((nonce) => ({
            c_nonce: nonce,
        }));
    }
}
