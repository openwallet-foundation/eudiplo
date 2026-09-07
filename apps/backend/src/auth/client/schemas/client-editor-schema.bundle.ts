import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../shared/common/zod/editor-schema.js";
import { CreateClientSchema, UpdateClientSchema } from "./client.schema.js";

export const clientEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "client",
    schemas: [
        defineEditorSchema({
            name: "CreateClientDto",
            schema: CreateClientSchema,
        }),
        defineEditorSchema({
            name: "UpdateClientDto",
            schema: UpdateClientSchema,
        }),
    ],
});
