import type { AuthorizationServerMetadata } from "@openid4vc/oauth2";
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