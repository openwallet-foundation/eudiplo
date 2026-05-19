import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { SessionStatus } from "../entities/session.entity";

export type SessionSortBy = "id" | "status" | "createdAt" | "requestId";
export type SessionSortOrder = "asc" | "desc";

export type SessionType = "issuance" | "presentation";

/**
 * Query parameters for filtering and paginating the session list.
 */
export class SessionQueryDto {
    /**
     * Page number (1-based).
     */
    @ApiPropertyOptional({
        description: "Page number (1-based)",
        default: 1,
        minimum: 1,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Type(() => Number)
    page: number = 1;

    /**
     * Number of items per page (max 100).
     */
    @ApiPropertyOptional({
        description: "Number of items per page",
        default: 25,
        minimum: 1,
        maximum: 100,
    })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    @Type(() => Number)
    pageSize: number = 25;

    /**
     * Filter sessions by status.
     */
    @ApiPropertyOptional({
        enum: SessionStatus,
        description: "Filter by session status",
    })
    @IsOptional()
    @IsEnum(SessionStatus)
    status?: SessionStatus;

    /**
     * Filter sessions by type (issuance or presentation).
     */
    @ApiPropertyOptional({
        enum: ["issuance", "presentation"],
        description: "Filter by session type",
    })
    @IsOptional()
    @IsEnum(["issuance", "presentation"])
    type?: SessionType;

    /**
     * Field to sort by.
     */
    @ApiPropertyOptional({
        enum: ["id", "status", "createdAt", "requestId"],
        description: "Field to sort by",
    })
    @IsOptional()
    @IsIn(["id", "status", "createdAt", "requestId"])
    sortBy?: SessionSortBy;

    /**
     * Sort order (asc or desc).
     */
    @ApiPropertyOptional({
        enum: ["asc", "desc"],
        description: "Sort direction",
    })
    @IsOptional()
    @IsIn(["asc", "desc"])
    sortOrder?: SessionSortOrder;
}
