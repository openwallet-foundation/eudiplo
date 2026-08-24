import {
    defineEditorSchema,
    defineEditorSchemaBundle,
} from "../../../shared/common/zod/editor-schema";
import {
    KeyChainConfigFileSchema,
    KeyChainCreateSchema,
    KeyChainImportSchema,
    KeyChainUpdateSchema,
    RotationPolicyCreateSchema,
    RotationPolicyUpdateSchema,
} from "./key-chain.schema";

export const keyChainEditorSchemaBundle = defineEditorSchemaBundle({
    domain: "key-chain",
    schemas: [
        defineEditorSchema({
            name: "KeyChainConfigFile",
            schema: KeyChainConfigFileSchema,
        }),
        defineEditorSchema({
            name: "KeyChainImportDto",
            schema: KeyChainImportSchema,
        }),
        defineEditorSchema({
            name: "KeyChainCreateDto",
            schema: KeyChainCreateSchema,
        }),
        defineEditorSchema({
            name: "KeyChainUpdateDto",
            schema: KeyChainUpdateSchema,
        }),
        defineEditorSchema({
            name: "RotationPolicyCreateDto",
            schema: RotationPolicyCreateSchema,
        }),
        defineEditorSchema({
            name: "RotationPolicyUpdateDto",
            schema: RotationPolicyUpdateSchema,
        }),
    ],
});
