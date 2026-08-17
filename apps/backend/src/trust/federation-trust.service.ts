import { X509Certificate } from "node:crypto";
import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { decodeJwt } from "jose";
import { firstValueFrom } from "rxjs";
import { FederationTrustMode, FederationTrustSource } from "./types";

type FederationTrustEvaluation = {
    trusted: boolean;
    reason: string;
};

type CachedEvaluation = {
    value: FederationTrustEvaluation;
    expiresAt: number;
};

type FederationEntityConfigurationPayload = {
    sub?: string;
    authority_hints?: string[];
    metadata?: Record<string, unknown>;
};

@Injectable()
export class FederationTrustService {
    private readonly logger = new Logger(FederationTrustService.name);
    private readonly trustCache = new Map<string, CachedEvaluation>();

    constructor(private readonly httpService: HttpService) {}

    getMode(source?: FederationTrustSource): FederationTrustMode {
        return source?.mode ?? "hybrid";
    }

    isEnabled(source?: FederationTrustSource): boolean {
        return Boolean(source?.trustAnchors?.length);
    }

    shouldUseLote(source?: FederationTrustSource): boolean {
        const mode = this.getMode(source);
        return mode === "lote-only" || mode === "hybrid";
    }

    shouldUseFederation(source?: FederationTrustSource): boolean {
        const mode = this.getMode(source);
        return mode === "federation-only" || mode === "hybrid";
    }

    async evaluateCertificateEntityTrust(
        x5c: string[] | undefined,
        source?: FederationTrustSource,
    ): Promise<FederationTrustEvaluation> {
        if (!this.shouldUseFederation(source)) {
            return { trusted: true, reason: "federation disabled by mode" };
        }

        if (!this.isEnabled(source)) {
            return {
                trusted: false,
                reason: "federation mode requires trust anchors, none configured",
            };
        }

        if (!x5c?.length) {
            return {
                trusted: false,
                reason: "federation mode requires x5c for entity extraction",
            };
        }

        const leafEntityId = this.tryExtractEntityIdFromLeaf(x5c[0]);
        if (!leafEntityId) {
            return {
                trusted: false,
                reason: "could not extract entity id from certificate SAN/CN",
            };
        }

        return this.evaluateEntityTrust(leafEntityId, source);
    }

    async evaluateAuthorizationServerTrust(
        issuerOrBaseUrl: string,
        source?: FederationTrustSource,
    ): Promise<FederationTrustEvaluation> {
        if (!this.shouldUseFederation(source)) {
            return { trusted: true, reason: "federation disabled by mode" };
        }

        if (!this.isEnabled(source)) {
            return {
                trusted: false,
                reason: "federation mode requires trust anchors, none configured",
            };
        }

        return this.evaluateEntityTrust(issuerOrBaseUrl, source);
    }

    async evaluateEntityTrust(
        entityId: string,
        source?: FederationTrustSource,
    ): Promise<FederationTrustEvaluation> {
        if (!this.shouldUseFederation(source)) {
            return { trusted: true, reason: "federation disabled by mode" };
        }

        if (!this.isEnabled(source)) {
            return {
                trusted: false,
                reason: "federation mode requires trust anchors, none configured",
            };
        }

        const normalizedEntityId = entityId.replace(/\/$/, "");
        const cacheKey = `${normalizedEntityId}::${JSON.stringify(source?.trustAnchors ?? [])}`;
        const cached = this.trustCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        }

        const anchorIds = new Set(
            (source?.trustAnchors ?? []).map((anchor) =>
                anchor.entityId.replace(/\/$/, ""),
            ),
        );

        if (anchorIds.has(normalizedEntityId)) {
            const value = {
                trusted: true,
                reason: "entity is a configured federation trust anchor",
            };
            this.setCache(cacheKey, source, value);
            return value;
        }

        const entityConfig = await this.fetchEntityConfiguration(
            normalizedEntityId,
        ).catch((error: unknown) => {
            this.logger.warn(
                `Failed to fetch federation entity configuration for ${normalizedEntityId}: ${String(error)}`,
            );
            return null;
        });

        if (!entityConfig) {
            const value = {
                trusted: false,
                reason: "could not fetch federation entity configuration",
            };
            this.setCache(cacheKey, source, value);
            return value;
        }

        const hints = new Set(
            (entityConfig.authority_hints ?? []).map((hint) =>
                hint.replace(/\/$/, ""),
            ),
        );

        const hintMatch = [...anchorIds].some((anchor) => hints.has(anchor));
        const subjectMatches =
            !entityConfig.sub ||
            entityConfig.sub.replace(/\/$/, "") === normalizedEntityId;

        const trusted = subjectMatches && hintMatch;
        const value = trusted
            ? {
                  trusted: true,
                  reason: "entity authority_hints chain to configured trust anchor",
              }
            : {
                  trusted: false,
                  reason: "entity did not chain to configured trust anchor",
              };

        this.setCache(cacheKey, source, value);
        return value;
    }

    private setCache(
        cacheKey: string,
        source: FederationTrustSource | undefined,
        value: FederationTrustEvaluation,
    ) {
        const ttlMs = Math.max(5, source?.cacheTtlSeconds ?? 300) * 1000;
        this.trustCache.set(cacheKey, {
            value,
            expiresAt: Date.now() + ttlMs,
        });
    }

    private tryExtractEntityIdFromLeaf(leafX5cBase64: string): string | null {
        try {
            const cert = new X509Certificate(
                Buffer.from(leafX5cBase64, "base64"),
            );

            if (cert.subjectAltName) {
                const uriMatch = cert.subjectAltName
                    .split(",")
                    .map((part) => part.trim())
                    .find((part) => part.startsWith("URI:"));

                if (uriMatch) {
                    return uriMatch.slice(4);
                }
            }

            const cnMatch = cert.subject
                .split(",")
                .map((part) => part.trim())
                .find((part) => part.startsWith("CN="));

            return cnMatch ? cnMatch.slice(3) : null;
        } catch (error) {
            this.logger.debug(
                `Could not parse x5c leaf certificate: ${String(error)}`,
            );
            return null;
        }
    }

    private async fetchEntityConfiguration(
        entityId: string,
    ): Promise<FederationEntityConfigurationPayload> {
        const wellKnownUrl = `${entityId.replace(/\/$/, "")}/.well-known/openid-federation`;

        const response = await firstValueFrom(
            this.httpService.get<string | Record<string, unknown>>(
                wellKnownUrl,
                {
                    responseType: "text" as never,
                },
            ),
        );

        return this.parseEntityConfigurationResponse(response.data, entityId);
    }

    private parseEntityConfigurationResponse(
        responseData: string | Record<string, unknown>,
        entityId: string,
    ): FederationEntityConfigurationPayload {
        if (typeof responseData === "string") {
            const trimmed = responseData.trim();
            if (trimmed.startsWith("{")) {
                return JSON.parse(
                    trimmed,
                ) as FederationEntityConfigurationPayload;
            }

            if (trimmed.split(".").length >= 2) {
                return decodeJwt(
                    trimmed,
                ) as FederationEntityConfigurationPayload;
            }
        }

        if (responseData && typeof responseData === "object") {
            const maybeJwt = (responseData as Record<string, unknown>)[
                "entity_configuration"
            ];
            if (
                typeof maybeJwt === "string" &&
                maybeJwt.split(".").length >= 2
            ) {
                return decodeJwt(
                    maybeJwt,
                ) as FederationEntityConfigurationPayload;
            }

            return responseData as FederationEntityConfigurationPayload;
        }

        throw new Error(
            `Unsupported federation entity configuration response for ${entityId}`,
        );
    }
}
