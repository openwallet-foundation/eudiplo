import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../shared/common/zod/editor-schema";
import { CreateClientSchema, UpdateClientSchema } from "./client.schema";

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
