import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../shared/common/zod/editor-schema";
import {
    CreateTenantSchema,
    ImportTenantSchema,
    UpdateTenantSchema,
} from "./create-tenant.schema";
import { SessionStorageConfigSchema } from "./session-storage-config.schema";
import { StatusListConfigSchema } from "./status-list-config.schema";

export const tenantEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "tenant",
    schemas: [
        defineEditorSchema({
            name: "CreateTenantDto",
            schema: CreateTenantSchema,
        }),
        defineEditorSchema({
            name: "ImportTenantDto",
            schema: ImportTenantSchema,
        }),
        defineEditorSchema({
            name: "UpdateTenantDto",
            schema: UpdateTenantSchema,
        }),
        defineEditorSchema({
            name: "SessionStorageConfig",
            schema: SessionStorageConfigSchema,
        }),
        defineEditorSchema({
            name: "StatusListConfig",
            schema: StatusListConfigSchema,
        }),
    ],
});
