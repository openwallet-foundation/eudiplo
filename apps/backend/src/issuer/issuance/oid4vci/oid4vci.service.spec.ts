import type { AuthorizationServerMetadata } from "@openid4vc/oauth2";
import { of, throwError } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { Oid4vciService } from "./oid4vci.service";

describe("Oid4vciService internal JWKS resolution", () => {
    it("uses INTERNAL_URL only for the built-in authorization server", () => {
        const service = Object.assign(
            Object.create(Oid4vciService.prototype) as Oid4vciService,
            {
                configService: {
                    get: vi.fn(() => "http://127.0.0.1:3000/"),
                },
                authzService: {
                    getAuthzIssuer: vi.fn(
                        (tenantId: string) =>
                            `https://issuer.example/issuers/${tenantId}`,
                    ),
                },
            },
        );
        const authorizationServers = [
            {
                issuer: "https://issuer.example/issuers/acme",
                jwks_uri:
                    "https://issuer.example/.well-known/jwks.json/issuers/acme",
            },
            {
                issuer: "https://external.example",
                jwks_uri: "https://external.example/jwks",
            },
        ] as AuthorizationServerMetadata[];

        const resolvedAuthorizationServers = service[
            "getAuthorizationServersForResourceVerification"
        ]("acme", authorizationServers);

        expect(resolvedAuthorizationServers).toEqual([
            {
                issuer: "https://issuer.example/issuers/acme",
                jwks_uri:
                    "http://127.0.0.1:3000/.well-known/jwks.json/issuers/acme",
            },
            {
                issuer: "https://external.example",
                jwks_uri: "https://external.example/jwks",
            },
        ]);
        expect(authorizationServers[0].jwks_uri).toBe(
            "https://issuer.example/.well-known/jwks.json/issuers/acme",
        );
    });
});

describe("Oid4vciService authorization server metadata caching & deduplication", () => {
    it("caches AS metadata and deduplicates concurrent in-flight requests", async () => {
        const httpGetMock = vi.fn().mockReturnValue(
            of({
                data: {
                    issuer: "https://as.example.org",
                    token_endpoint: "https://as.example.org/token",
                },
            }),
        );
        const addCounterMock = vi.fn();
        const metricServiceMock = {
            getCounter: vi.fn(() => ({
                add: addCounterMock,
            })),
        };

        const service = Object.assign(
            Object.create(Oid4vciService.prototype) as Oid4vciService,
            {
                httpService: { get: httpGetMock },
                asMetadataCache: new Map(),
                inFlightAsMetadataRequests: new Map(),
                logger: { debug: vi.fn(), warn: vi.fn() },
                asMetadataHitsCounter: metricServiceMock.getCounter(),
                asMetadataMissesCounter: metricServiceMock.getCounter(),
                asMetadataStaleCounter: metricServiceMock.getCounter(),
                asMetadataFetchesCounter: metricServiceMock.getCounter(),
            },
        );

        const [m1, m2, m3] = await Promise.all([
            service["fetchAuthorizationServerMetadata"]("https://as.example.org"),
            service["fetchAuthorizationServerMetadata"]("https://as.example.org"),
            service["fetchAuthorizationServerMetadata"]("https://as.example.org"),
        ]);

        expect(m1.issuer).toBe("https://as.example.org");
        expect(m2.issuer).toBe("https://as.example.org");
        expect(m3.issuer).toBe("https://as.example.org");
        expect(httpGetMock).toHaveBeenCalledTimes(1);

        // Next call hits cache
        const m4 = await service["fetchAuthorizationServerMetadata"](
            "https://as.example.org",
        );
        expect(m4.issuer).toBe("https://as.example.org");
        expect(httpGetMock).toHaveBeenCalledTimes(1);
    });

    it("serves stale metadata if fresh fetch fails and stale entry exists", async () => {
        const httpGetMock = vi
            .fn()
            .mockReturnValueOnce(
                of({
                    data: {
                        issuer: "https://as.example.org",
                        token_endpoint: "https://as.example.org/token",
                    },
                }),
            )
            .mockReturnValueOnce(
                throwError(() => new Error("Upstream server error")),
            );

        const service = Object.assign(
            Object.create(Oid4vciService.prototype) as Oid4vciService,
            {
                httpService: { get: httpGetMock },
                asMetadataCache: new Map(),
                inFlightAsMetadataRequests: new Map(),
                logger: { debug: vi.fn(), warn: vi.fn() },
            },
        );

        // First fetch -> populates cache
        await service["fetchAuthorizationServerMetadata"]("https://as.example.org");

        // Force item in cache to be expired
        const cachedItem = service["asMetadataCache"].get("https://as.example.org");
        cachedItem.expiresAt = Date.now() - 1000;

        // Second fetch -> fresh fetch fails, fallback to stale metadata
        const stale = await service["fetchAuthorizationServerMetadata"](
            "https://as.example.org",
        );

        expect(stale.issuer).toBe("https://as.example.org");
        expect(httpGetMock).toHaveBeenCalledTimes(3);
        expect(service["logger"].warn).toHaveBeenCalledWith(
            expect.stringContaining("returning stale cached metadata"),
        );
    });
});
