import { OmitType } from "@nestjs/swagger";
import { TENANT_RELATION_FIELDS } from "../../../shared/utils/dto-omit-fields";
import { ClientEntity } from "../entities/client.entity";

export class CreateClientDto extends OmitType(ClientEntity, [
    ...TENANT_RELATION_FIELDS,
] as const) {}
