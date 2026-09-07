import { describe, expect, it } from "vitest";
import { Role } from "../../auth/roles/role.enum.js";
import { ROLES_KEY } from "../../auth/roles/roles.decorator.js";
import { ConfigPortabilityController } from "./config-portability.controller.js";

describe("ConfigPortabilityController authorization", () => {
    it.each(["export", "import", "importArchive", "detach"] as const)(
        "requires tenant configuration-management permission for %s",
        (method) => {
            expect(
                Reflect.getMetadata(
                    ROLES_KEY,
                    ConfigPortabilityController.prototype[method],
                ),
            ).toEqual([Role.Tenants, Role.TenantAdmin]);
        },
    );
});
