import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../shared/common/zod/editor-schema";
import { CreateRegistrarConfigSchema } from "./registrar.schema";

export const registrarEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "registrar",
    schemas: [
        defineEditorSchema({
            name: "CreateRegistrarConfigDto",
            schema: CreateRegistrarConfigSchema,
        }),
    ],
});
