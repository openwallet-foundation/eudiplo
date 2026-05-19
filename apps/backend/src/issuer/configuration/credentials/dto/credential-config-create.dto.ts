import { OmitType } from "@nestjs/swagger";
import { TENANT_RELATION_FIELDS } from "../../../../shared/utils/dto-omit-fields";
import { CredentialConfig } from "../entities/credential.entity";

export class CredentialConfigCreate extends OmitType(CredentialConfig, [
    ...TENANT_RELATION_FIELDS,
    "keyChain",
    "attributeProvider",
    "webhookEndpoint",
]) {}
