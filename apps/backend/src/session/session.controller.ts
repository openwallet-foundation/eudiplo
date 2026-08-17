import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    Param,
    Post,
    Query,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Role } from "../auth/roles/role.enum";
import { Secured } from "../auth/secure.decorator";
import { Token, TokenPayload } from "../auth/token.decorator";
import { StatusUpdateDto } from "../issuer/status-list/dto/status-update.dto";
import { StatusListService } from "../issuer/status-list/status-list.service";
import { SessionLogStoreService } from "./logging/session-log-store.service";
import { PaginatedSessionResponseDto } from "./dto/paginated-session-response.dto";
import { SessionLogEntryResponseDto } from "./dto/session-log-entry-response.dto";
import { SessionQueryDto } from "./dto/session-query.dto";
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

    /**
     * Retrieves a paginated list of sessions with optional filters.
     */
    @ApiOperation({ summary: "Get sessions (paginated)" })
    @ApiResponse({ status: 200, type: PaginatedSessionResponseDto })
    @Get()
    getAllSessions(
        @Token() token: TokenPayload,
        @Query() query: SessionQueryDto,
    ): Promise<PaginatedSessionResponseDto> {
        return this.sessionService.getAll(token.entity!.id, query);
    }

    /**
     * Retrieves the session information for a given session ID.
     * @param id - The identifier of the session.
     */
    @ApiParam({ name: "id", description: "The session ID", type: String })
    @Get(":id")
    getSession(
        @Param("id") id: string,
        @Token() token: TokenPayload,
    ): Promise<Session> {
        return this.sessionService.getBy({ id, tenantId: token.entity!.id });
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
