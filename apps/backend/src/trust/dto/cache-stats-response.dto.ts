import { ApiProperty } from "@nestjs/swagger";

class TrustListCacheStatsDto {
    @ApiProperty({ description: "Whether the trust list cache is populated" })
    hasCache!: boolean;
}

class StatusListCacheStatsDto {
    @ApiProperty({ description: "Number of cached status list entries" })
    size!: number;

    @ApiProperty({ description: "Number of cached JWT status list entries" })
    jwtCacheSize!: number;

    @ApiProperty({ description: "Cached status list URIs", type: [String] })
    uris!: string[];
}

export class CacheStatsResponseDto {
    @ApiProperty({ type: TrustListCacheStatsDto })
    trustListCache!: TrustListCacheStatsDto;

    @ApiProperty({ type: StatusListCacheStatsDto })
    statusListCache!: StatusListCacheStatsDto;
}
