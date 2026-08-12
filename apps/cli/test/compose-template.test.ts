import { describe, expect, it } from "vitest";
import { createComposeEnv, resolveImageTag } from "../src/compose-template.js";

describe("compose template helpers", () => {
    it("uses full stable version tags by default", () => {
        const env = createComposeEnv({ mode: "demo", cliVersion: "1.2.3" });

        expect(env).toContain("EUDIPLO_IMAGE=ghcr.io/openwallet-foundation/eudiplo:1.2.3");
        expect(env).toContain(
            "EUDIPLO_CLIENT_IMAGE=ghcr.io/openwallet-foundation/eudiplo-client:1.2.3",
        );
    });

    it("maps main prerelease versions to the main tag", () => {
        expect(resolveImageTag("2.0.0-main.abcdef1")).toBe("main");
    });

    it("supports explicit image tag overrides", () => {
        expect(resolveImageTag("2.0.0", "sha-deadbeef")).toBe("sha-deadbeef");
    });
});
