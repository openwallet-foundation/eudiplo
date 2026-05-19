import { ApiProperty } from "@nestjs/swagger";
import { Session } from "../entities/session.entity";

/**
 * Paginated response for the session list endpoint.
 */
export class PaginatedSessionResponseDto {
    /**
     * The sessions for the current page.
     */
    @ApiProperty({ type: [Session] })
    items!: Session[];

    /**
     * Total number of sessions matching the query.
     */
    @ApiProperty({ description: "Total number of sessions matching the query" })
    total!: number;

    /**
     * Current page number (1-based).
     */
    @ApiProperty({ description: "Current page number (1-based)" })
    page!: number;

    /**
     * Number of items per page.
     */
    @ApiProperty({ description: "Number of items per page" })
    pageSize!: number;

    /**
     * Total number of pages.
     */
    @ApiProperty({ description: "Total number of pages" })
    totalPages!: number;
}
