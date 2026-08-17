import { ApiProperty } from "@nestjs/swagger";

/**
 * Response DTO for status list aggregation endpoint.
 * Returns a list of all status list URIs for a tenant.
 * See RFC draft-ietf-oauth-status-list Section 9.3.
 */
export class StatusListAggregationDto {
    /**
     * Array of status list token URIs.
     * Each URI points to a status list JWT endpoint.
     */
    @ApiProperty({
        description: "Array of status list token URIs",
        type: [String],
        example: [
            "https://example.com/tenant-123/status-management/status-list/list-1",
            "https://example.com/tenant-123/status-management/status-list/list-2",
        ],
    })
    status_lists!: string[];
}
