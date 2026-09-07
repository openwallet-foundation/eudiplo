import { OmitType } from "@nestjs/swagger";
import { TENANT_RELATION_FIELDS } from "../../../../shared/utils/dto-omit-fields.js";
import { CredentialConfig } from "../entities/credential.entity.js";

export class CredentialConfigCreate extends OmitType(CredentialConfig, [
    ...TENANT_RELATION_FIELDS,
    "keyChain",
    "attributeProvider",
    "webhookEndpoint",
]) {}
