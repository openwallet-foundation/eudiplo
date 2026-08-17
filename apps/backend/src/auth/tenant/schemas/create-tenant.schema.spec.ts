import { describe, expect, test } from "vitest";
import { CreateTenantSchema, UpdateTenantSchema } from "./create-tenant.schema";

describe("tenant request schemas", () => {
    test("allows create without a description", () => {
        expect(
            CreateTenantSchema.parse({ id: "tenant", name: "Tenant" }),
        ).not.toHaveProperty("description");
    });

    test("trims non-blank create descriptions", () => {
        expect(
            CreateTenantSchema.parse({
                id: "tenant",
                name: "Tenant",
                description: "  Example tenant  ",
            }).description,
        ).toBe("Example tenant");
    });

    test.each(["", "   "])(
        "rejects a blank create description (%j)",
        (description) => {
            expect(
                CreateTenantSchema.safeParse({
                    id: "tenant",
                    name: "Tenant",
                    description,
                }).success,
            ).toBe(false);
        },
    );

    test("keeps omitted update fields omitted without applying create defaults", () => {
        expect(UpdateTenantSchema.parse({})).toEqual({});
    });

    test("trims non-blank update descriptions", () => {
        expect(
            UpdateTenantSchema.parse({ description: "  Updated  " }),
        ).toEqual({ description: "Updated" });
    });

    test("allows an update description to be cleared", () => {
        expect(UpdateTenantSchema.parse({ description: null })).toEqual({
            description: null,
        });
    });

    test.each(["", "   "])(
        "rejects a blank update description (%j)",
        (description) => {
            expect(UpdateTenantSchema.safeParse({ description }).success).toBe(
                false,
            );
        },
    );

    test("rejects create-only properties in updates", () => {
        expect(
            UpdateTenantSchema.safeParse({ roles: ["clients:manage"] }).success,
        ).toBe(false);
        expect(UpdateTenantSchema.safeParse({ id: "tenant" }).success).toBe(
            false,
        );
    });
});
