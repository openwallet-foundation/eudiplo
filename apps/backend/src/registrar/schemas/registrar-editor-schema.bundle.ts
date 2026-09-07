import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../shared/common/zod/editor-schema.js";
import { CreateRegistrarConfigSchema } from "./registrar.schema.js";

export const registrarEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "registrar",
    schemas: [
        defineEditorSchema({
            name: "CreateRegistrarConfigDto",
            schema: CreateRegistrarConfigSchema,
        }),
    ],
});
