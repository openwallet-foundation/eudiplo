import { Injectable, Logger } from "@nestjs/common";
import type { LoTE } from "@owf/eudi-lote";
import { decodeJwt } from "jose";
import { LoteParserService } from "./lote-parser.service";
import { TrustListJwtService } from "./trustlist-jwt.service";
import { TrustedEntity, TrustListSource } from "./types";

/**
 * Built trust store with TrustedEntities preserving service groupings.
 */
export type BuiltTrustStore = {
    fetchedAt: number;
    nextUpdate?: string;
    /** TrustedEntities with their services (issuance + revocation) grouped */
    entities: TrustedEntity[];
};

@Injectable()
export class TrustStoreService {
    private readonly logger = new Logger(TrustStoreService.name);
    private readonly cache = new Map<string, BuiltTrustStore>();

    constructor(
        private readonly trustListJwt: TrustListJwtService,
        private readonly loteParser: LoteParserService,
    ) {}

    async getTrustStore(
        source: TrustListSource,
        cacheTtlMs = 5 * 60 * 1000,
    ): Promise<BuiltTrustStore> {
        const cacheKey = this.buildCacheKey(source);
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.fetchedAt < cacheTtlMs) {
            return cached;
        }

        const entities: TrustedEntity[] = [];
        let nextUpdate: string | undefined;

        for (const ref of source.lotes) {
            this.logger.debug(`Fetching trust list from: ${ref.url}`);
            const jwt = await this.trustListJwt.fetchJwt(ref.url);
            await this.trustListJwt.verifyTrustListJwt(ref, jwt); // hook
            const decoded = decodeJwt<{ LoTE: LoTE }>(jwt);

            this.logger.debug(
                `Decoded LoTE from ${ref.url}: TrustedEntitiesList has ${decoded.LoTE.TrustedEntitiesList?.length ?? 0} raw entries`,
            );

            let parsed = this.loteParser.parse(decoded.LoTE);
            this.logger.debug(
                `Parsed ${parsed.entities.length} entities from ${ref.url}`,
            );

            if (source.acceptedServiceTypes) {
                this.logger.debug(
                    `Filtering by accepted service types: ${source.acceptedServiceTypes.join(", ")}`,
                );
                const beforeFilter = parsed.entities.length;
                parsed = this.loteParser.filterByServiceTypes(
                    parsed,
                    source.acceptedServiceTypes,
                );
                this.logger.debug(
                    `After filtering: ${parsed.entities.length} entities (was ${beforeFilter})`,
                );
            }

            nextUpdate = nextUpdate ?? parsed.info.nextUpdate;

            // Add entities preserving grouping
            for (const entity of parsed.entities) {
                entities.push(entity);
            }
        }

        const store: BuiltTrustStore = {
            fetchedAt: Date.now(),
            nextUpdate,
            entities,
        };
        this.cache.set(cacheKey, store);

        this.logger.debug(
            `Built trust store with ${entities.length} trusted entit${entities.length === 1 ? "y" : "ies"}`,
        );
        return store;
    }

    /**
     * Clear the cached trust store.
     * Useful for testing or when trust lists are known to have changed.
     */
    clearCache(): void {
        this.cache.clear();
    }

    private buildCacheKey(source: TrustListSource): string {
        return JSON.stringify({
            lotes: source.lotes.map((ref) => ({
                url: ref.url,
                verifierKey: ref.verifierKey ?? null,
            })),
            acceptedServiceTypes: source.acceptedServiceTypes ?? [],
        });
    }
}
