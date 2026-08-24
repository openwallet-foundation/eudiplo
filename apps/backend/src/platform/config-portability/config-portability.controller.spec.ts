import { describe, expect, it } from "vitest";
import { Role } from "../../auth/roles/role.enum";
import { ROLES_KEY } from "../../auth/roles/roles.decorator";
import { ConfigPortabilityController } from "./config-portability.controller";

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
