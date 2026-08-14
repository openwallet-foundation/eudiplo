import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    GoneException,
    Get,
    HttpCode,
    Param,
    Post,
    Query,
    UnauthorizedException,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Role } from "../auth/roles/role.enum";
import { Secured } from "../auth/secure.decorator";
import { Token, TokenPayload } from "../auth/token.decorator";
import { StatusUpdateDto } from "../issuer/lifecycle/status/dto/status-update.dto";
import { StatusListService } from "../issuer/lifecycle/status/status-list.service";
import { SessionLogStoreService } from "../shared/utils/logger/session-log-store.service";
import { PaginatedSessionResponseDto } from "./dto/paginated-session-response.dto";
import { SessionLogEntryResponseDto } from "./dto/session-log-entry-response.dto";
import { SessionQueryDto } from "./dto/session-query.dto";
import { SessionResultQueryDto } from "./dto/session-result-query.dto";
import { SessionResultResponseDto } from "./dto/session-result-response.dto";
import { Session } from "./entities/session.entity";
import { SessionService } from "./session.service";

@ApiTags("Session")
@Secured([Role.IssuanceOffer, Role.PresentationRequest])
@Controller("session")
export class SessionController {
    constructor(
        private readonly sessionService: SessionService,
        private readonly statusListService: StatusListService,
        private readonly logStoreService: SessionLogStoreService,
    ) {}

    private sanitizeSessionResponse(session: Session): Session {
        return {
            ...session,
            responseCode: undefined,
            responseCodeHash: undefined,
            responseCodeExpiresAt: undefined,
            responseCodeConsumedAt: undefined,
        };
    }

    /**
     * Retrieves a paginated list of sessions with optional filters.
     */
    @ApiOperation({ summary: "Get sessions (paginated)" })
    @ApiResponse({ status: 200, type: PaginatedSessionResponseDto })
    @Get()
    async getAllSessions(
        @Token() token: TokenPayload,
        @Query() query: SessionQueryDto,
    ): Promise<PaginatedSessionResponseDto> {
        const result = await this.sessionService.getAll(
            token.entity!.id,
            query,
        );
        return {
            ...result,
            items: result.items.map((item) =>
                this.sanitizeSessionResponse(item),
            ),
        };
    }

    /**
     * Retrieves the session information for a given session ID.
     * @param id - The identifier of the session.
     */
    @ApiParam({ name: "id", description: "The session ID", type: String })
    @Get(":id")
    async getSession(
        @Param("id") id: string,
        @Token() token: TokenPayload,
    ): Promise<Session> {
        const session = await this.sessionService.getBy({
            id,
            tenantId: token.entity!.id,
        });
        return this.sanitizeSessionResponse(session);
    }

    @ApiParam({ name: "id", description: "The session ID", type: String })
    @ApiOperation({
        summary:
            "Get RP-facing presentation result (same-device with response_code or cross-device polling)",
    })
    @ApiResponse({ status: 200, type: SessionResultResponseDto })
    @Get(":id/result")
    async getSessionResult(
        @Param("id") id: string,
        @Query() query: SessionResultQueryDto,
        @Token() token: TokenPayload,
    ): Promise<SessionResultResponseDto> {
        const session = await this.sessionService.getBy({
            id,
            tenantId: token.entity!.id,
        });

        if (session.redirectUri) {
            if (!query.response_code) {
                throw new BadRequestException(
                    "response_code is required for redirected presentation results",
                );
            }

            const consumeResult = await this.sessionService.consumeResponseCode(
                id,
                query.response_code,
            );

            if (consumeResult === "missing" || consumeResult === "invalid") {
                throw new UnauthorizedException("Invalid response_code");
            }

            if (consumeResult === "expired") {
                throw new GoneException("response_code expired");
            }

            if (consumeResult === "consumed") {
                throw new UnauthorizedException(
                    "response_code already consumed",
                );
            }
        }

        if (session.status === "completed") {
            return {
                status: session.status,
                credentials: session.credentials ?? [],
            };
        }

        if (session.status === "failed") {
            return {
                status: session.status,
                failure: session.presentationFailureCode
                    ? {
                          code: session.presentationFailureCode,
                          protocolError:
                              session.presentationFailureProtocolError ??
                              undefined,
                      }
                    : undefined,
            };
        }

        return {
            status: session.status,
        };
    }

    /**
     * Deletes a session by its ID
     * @param id
     * @param user
     * @returns
     */
    @Delete(":id")
    @ApiResponse({ status: 204, description: "Session deleted" })
    @HttpCode(204)
    deleteSession(
        @Param("id") id: string,
        @Token() user: TokenPayload,
    ): Promise<void> {
        return this.sessionService.delete(id, user.entity!.id);
    }

    /**
     * Retrieves the log entries for a given session.
     * @param id - The session ID.
     */
    @ApiParam({ name: "id", description: "The session ID", type: String })
    @ApiOperation({ summary: "Get session log entries" })
    @ApiResponse({ status: 200, type: [SessionLogEntryResponseDto] })
    @Get(":id/logs")
    async getSessionLogs(
        @Param("id") id: string,
        @Token() token: TokenPayload,
    ): Promise<SessionLogEntryResponseDto[]> {
        await this.sessionService.getBy({ id, tenantId: token.entity!.id });
        return this.logStoreService.findBySessionId(id);
    }

    /**
     * Update the status of the credentials of a specific session.
     * @param value
     * @returns
     */
    @Post("revoke")
    @ApiResponse({ status: 204, description: "All sessions revoked" })
    @HttpCode(204)
    revokeAll(@Body() value: StatusUpdateDto, @Token() user: TokenPayload) {
        return this.statusListService.updateStatus(value, user.entity!.id);
    }
}
