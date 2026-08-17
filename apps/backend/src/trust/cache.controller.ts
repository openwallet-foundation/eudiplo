import { Controller, Delete, Get, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Role } from "../auth/roles/role.enum";
import { Secured } from "../auth/secure.decorator";
import { CacheStatsResponseDto } from "./dto/cache-stats-response.dto";
import { StatusListVerifierService } from "./status-list-verifier.service";
import { TrustStoreService } from "./trust-store.service";

/**
 * Controller for managing trust and status list caches.
 * Useful for forcing a refresh when trust lists or status lists are known to have changed.
 *
 * Note: Caches are stored in RAM only - a server restart will also clear them.
 */
@ApiTags("Cache Management")
@Controller("cache")
@Secured([Role.Issuances, Role.Presentations])
export class CacheController {
    constructor(
        private readonly trustStoreService: TrustStoreService,
        private readonly statusListVerifierService: StatusListVerifierService,
    ) {}

    /**
     * Get cache statistics for monitoring.
     */
    @Get("stats")
    @ApiOperation({
        summary: "Get cache statistics",
        description:
            "Returns statistics about the trust list and status list caches.",
    })
    @ApiResponse({
        status: 200,
        description: "Cache statistics",
        type: CacheStatsResponseDto,
    })
    getStats(): CacheStatsResponseDto {
        const statusListStats = this.statusListVerifierService.getCacheStats();
        return {
            trustListCache: {
                // Trust store has a single cache entry
                hasCache: true, // We can't easily check without accessing private property
            },
            statusListCache: {
                size: statusListStats.size,
                jwtCacheSize: statusListStats.jwtCacheSize,
                uris: statusListStats.uris,
            },
        };
    }

    /**
     * Clear all caches (trust lists and status lists).
     */
    @Delete()
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: "Clear all caches",
        description:
            "Clears both trust list and status list caches. Next verification will fetch fresh data.",
    })
    @ApiResponse({
        status: 204,
        description: "All caches cleared successfully",
    })
    clearAllCaches() {
        this.trustStoreService.clearCache();
        this.statusListVerifierService.clearCache();
    }

    /**
     * Clear the trust list cache.
     */
    @Delete("trust-list")
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: "Clear trust list cache",
        description:
            "Clears the trust list cache. Next verification will fetch fresh trust lists.",
    })
    @ApiResponse({
        status: 204,
        description: "Trust list cache cleared successfully",
    })
    clearTrustListCache() {
        this.trustStoreService.clearCache();
    }

    /**
     * Clear the status list (revocation) cache.
     */
    @Delete("status-list")
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: "Clear status list cache",
        description:
            "Clears the status list (revocation) cache. Next status check will fetch fresh status lists.",
    })
    @ApiResponse({
        status: 204,
        description: "Status list cache cleared successfully",
    })
    clearStatusListCache() {
        this.statusListVerifierService.clearCache();
    }
}
