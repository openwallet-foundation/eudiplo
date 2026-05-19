import { OmitType } from "@nestjs/swagger";
import { TENANT_RELATION_FIELDS } from "../../../../shared/utils/dto-omit-fields";
import { WebhookEndpointEntity } from "../entities/webhook-endpoint.entity";

export class CreateWebhookEndpointDto extends OmitType(WebhookEndpointEntity, [
    ...TENANT_RELATION_FIELDS,
]) {}
