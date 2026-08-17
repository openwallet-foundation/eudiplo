import { clientEditorSchemaBundle } from "../auth/client/schemas/client-editor-schema.bundle";
import { tenantEditorSchemaBundle } from "../auth/tenant/schemas/tenant-editor-schema.bundle";
import { certEditorSchemaBundle } from "../crypto/key/schemas/cert-editor-schema.bundle";
import { keyChainEditorSchemaBundle } from "../crypto/key/schemas/key-chain-editor-schema.bundle";
import { kmsEditorSchemaBundle } from "../crypto/key/schemas/kms-editor-schema.bundle";
import { attributeProviderEditorSchemaBundle } from "../issuer/configuration/attribute-provider/schemas/attribute-provider-editor-schema.bundle";
import { credentialEditorSchemaBundle } from "../issuer/configuration/credentials/schemas/credential-editor-schema.bundle";
import { issuanceEditorSchemaBundle } from "../issuer/configuration/issuance/schemas/issuance-editor-schema.bundle";
import { webhookEndpointEditorSchemaBundle } from "../issuer/configuration/webhook-endpoint/schemas/webhook-endpoint-editor-schema.bundle";
import { statusListEditorSchemaBundle } from "../issuer/status-list/dto/status-list-editor-schema.bundle";
import { trustListEditorSchemaBundle } from "../issuer/trust-list/schemas/trust-list-editor-schema.bundle";
import { registrarEditorSchemaBundle } from "../registrar/schemas/registrar-editor-schema.bundle";
import type { EditorSchemaBundle } from "../shared/common/zod/editor-schema";
import { presentationEditorSchemaBundle } from "../verifier/presentations/schemas/presentation-editor-schema.bundle";
import { webhookEditorSchemaBundle } from "../webhook/webhook-editor-schema.bundle";

export const editorSchemaBundles: readonly EditorSchemaBundle[] = [
    clientEditorSchemaBundle,
    tenantEditorSchemaBundle,
    attributeProviderEditorSchemaBundle,
    webhookEndpointEditorSchemaBundle,
    keyChainEditorSchemaBundle,
    kmsEditorSchemaBundle,
    certEditorSchemaBundle,
    statusListEditorSchemaBundle,
    registrarEditorSchemaBundle,
    issuanceEditorSchemaBundle,
    credentialEditorSchemaBundle,
    presentationEditorSchemaBundle,
    trustListEditorSchemaBundle,
    webhookEditorSchemaBundle,
];
