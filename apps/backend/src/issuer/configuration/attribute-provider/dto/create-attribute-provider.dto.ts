import { OmitType } from "@nestjs/swagger";
import { TENANT_RELATION_FIELDS } from "../../../../shared/utils/dto-omit-fields";
import { AttributeProviderEntity } from "../entities/attribute-provider.entity";

export class CreateAttributeProviderDto extends OmitType(
    AttributeProviderEntity,
    TENANT_RELATION_FIELDS,
) {}
