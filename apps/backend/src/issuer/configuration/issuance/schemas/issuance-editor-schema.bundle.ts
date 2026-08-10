import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../../shared/common/zod/editor-schema";
import { IssuanceConfigSchema } from "./issuance.schema";

export const issuanceEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "issuance",
    schemas: [
        defineEditorSchema({
            name: "IssuanceConfig",
            schema: IssuanceConfigSchema,
        }),
    ],
});
