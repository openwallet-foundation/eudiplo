import { ApiPropertyOptional } from "@nestjs/swagger";
import { BitsPerStatus } from "@owf/token-status-list";

/**
 * Configuration for status list behavior per tenant.
 */
export class StatusListConfig {
    /**
     * The capacity of the status list (number of entries).
     * If not set, uses the global STATUS_CAPACITY environment variable (default: 10000).
     */
    @ApiPropertyOptional({
        description:
            "The capacity of the status list. If not set, uses global STATUS_CAPACITY.",
        example: 10000,
        minimum: 100,
    })
    capacity?: number;

    /**
     * The number of bits used per status entry.
     * - 1 bit: only valid/revoked states
     * - 2 bits: valid/revoked/suspended states
     * - 4 or 8 bits: extended status values
     * If not set, uses the global STATUS_BITS environment variable (default: 1).
     */
    @ApiPropertyOptional({
        description:
            "Bits per status entry: 1 (valid/revoked), 2 (with suspended), 4/8 (extended). If not set, uses global STATUS_BITS.",
        enum: [1, 2, 4, 8],
        default: 1,
    })
    bits?: BitsPerStatus;

    /**
     * Time-to-live in seconds for the status list JWT.
     * The JWT will include an `exp` claim enabling verifier caching.
     * When the TTL expires, a new JWT is generated on the next request.
     * If not set, uses the global STATUS_TTL environment variable (default: 3600 = 1 hour).
     */
    @ApiPropertyOptional({
        description:
            "TTL in seconds for the status list JWT. If not set, uses global STATUS_TTL.",
        example: 3600,
        minimum: 60,
    })
    ttl?: number;

    /**
     * If true, the JWT is regenerated immediately on every status change.
     * If false (default), the JWT is only regenerated when requested and the TTL has expired.
     * Use immediate mode for high-security scenarios where revocation must be visible instantly.
     */
    @ApiPropertyOptional({
        description:
            "If true, regenerate JWT immediately on status changes. If false (default), use lazy regeneration on TTL expiry.",
        default: false,
    })
    immediateUpdate?: boolean;

    /**
     * Whether to include the aggregation_uri in status list JWTs.
     * When enabled, each status list JWT will contain an aggregation_uri claim
     * pointing to an endpoint that returns all status list URIs for this tenant.
     * This allows relying parties to pre-fetch all status lists for offline validation.
     * See RFC draft-ietf-oauth-status-list Section 9.
     */
    @ApiPropertyOptional({
        description:
            "If true, include aggregation_uri in status list JWTs for pre-fetching support (default: true).",
        default: true,
    })
    enableAggregation?: boolean;
}
