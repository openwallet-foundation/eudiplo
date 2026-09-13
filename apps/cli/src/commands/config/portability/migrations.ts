import {
    migrateDocument,
    serializeDocument,
} from "@eudiplo/config-format/config-format.js";
import { validateConfigDocument } from "@eudiplo/config-format/config-validator.js";

export function upgradeDocument(input: unknown) {
    const result = migrateDocument(input, validateConfigDocument);
    return { ...result, document: serializeDocument(result.document) };
}
