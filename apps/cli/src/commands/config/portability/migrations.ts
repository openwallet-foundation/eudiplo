import {
    migrateDocument,
    serializeDocument,
} from "../../../generated/config-format.js";
import { validateConfigDocument } from "../../../generated/config-validator.js";

;
export function upgradeDocument(input: unknown) {
    const result = migrateDocument(input, validateConfigDocument);
    return { ...result, document: serializeDocument(result.document) };
}
