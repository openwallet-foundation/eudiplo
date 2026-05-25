import { RequestMethod } from "@nestjs/common";
import type { OpenAPIObject } from "@nestjs/swagger";

/**
 * Routes excluded from the automatic `/api` global prefix.
 * Wallet-facing and infrastructure endpoints stay at the root path for protocol
 * compliance and discoverability. The integrated OAuth2 token endpoint is
 * already mounted under `/api` so firewalls can treat it as part of the admin
 * surface without receiving a duplicate `/api/api` prefix.
 */
export const GLOBAL_PREFIX_EXCLUSIONS: {
    path: string;
    method: RequestMethod;
}[] = [
    // Infrastructure
    { path: "/", method: RequestMethod.GET },
    { path: "health", method: RequestMethod.ALL },
    // Admin authentication
    { path: "api/oauth2/{*path}", method: RequestMethod.ALL },
    // Discovery
    { path: ".well-known/{*path}", method: RequestMethod.ALL },
    // OID4VCI Protocol
    { path: "issuers/:tenantId/vci/{*path}", method: RequestMethod.ALL },
    { path: "issuers/:tenantId/authorize", method: RequestMethod.ALL },
    { path: "issuers/:tenantId/authorize/{*path}", method: RequestMethod.ALL },
    {
        path: "issuers/:tenantId/credentials-metadata/{*path}",
        method: RequestMethod.ALL,
    },
    { path: "issuers/:tenantId/chained-as/{*path}", method: RequestMethod.ALL },
    // OID4VP Protocol
    { path: "presentations/:sessionId/oid4vp", method: RequestMethod.ALL },
    {
        path: "presentations/:sessionId/oid4vp/{*path}",
        method: RequestMethod.ALL,
    },
    // Public Status & Trust Lists
    {
        path: "issuers/:tenantId/status-management/{*path}",
        method: RequestMethod.ALL,
    },
    { path: "issuers/:tenantId/trust-list/{*path}", method: RequestMethod.ALL },
    // Public Storage (credential images, logos)
    { path: "storage/:key", method: RequestMethod.GET },
];

/**
 * Filter an OpenAPI document to only include paths matching (or not matching)
 * a given predicate. Also prunes the tag list to only include tags that are
 * actually referenced by the remaining paths.
 */
export function filterOpenApiPaths(
    document: OpenAPIObject,
    predicate: (path: string) => boolean,
): OpenAPIObject {
    const filteredPaths: OpenAPIObject["paths"] = {};
    const usedTags = new Set<string>();

    for (const [path, pathItem] of Object.entries(document.paths)) {
        if (predicate(path)) {
            filteredPaths[path] = pathItem;
            for (const operation of Object.values(
                pathItem as Record<string, any>,
            )) {
                if (operation?.tags) {
                    for (const tag of operation.tags) {
                        usedTags.add(tag);
                    }
                }
            }
        }
    }

    return {
        ...document,
        paths: filteredPaths,
        tags: document.tags?.filter((tag: { name: string }) =>
            usedTags.has(tag.name),
        ),
    };
}
