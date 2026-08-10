import {
    ApiProperty,
    ApiPropertyOptional,
    getSchemaPath,
} from "@nestjs/swagger";
import { Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { TenantEntity } from "../../../../auth/tenant/entitites/tenant.entity";
import {
    WebHookAuthConfigHeader,
    WebHookAuthConfigNone,
} from "../../../../shared/utils/webhook/webhook.dto";

/**
 * An Attribute Provider is an external HTTPS endpoint called during
 * credential issuance to dynamically fetch claim values.
 *
 * Attribute Providers are configured once per tenant and can be
 * referenced by multiple credential configurations via `attributeProviderId`.
 */
@Entity()
export class AttributeProviderEntity {
    @PrimaryColumn("varchar")
    id!: string;

    @ApiProperty({ description: "Tenant identifier" })
    @Column("varchar", { primary: true })
    tenantId!: string;

    @ManyToOne(() => TenantEntity, { cascade: true, onDelete: "CASCADE" })
    tenant!: TenantEntity;

    @ApiProperty({ description: "Attribute provider name" })
    @Column("varchar")
    name!: string;

    @ApiPropertyOptional({ description: "Attribute provider description" })
    @Column("varchar", { nullable: true })
    description?: string | null;

    @ApiProperty({ description: "Attribute provider URL" })
    @Column("varchar")
    url!: string;

    @ApiProperty({
        oneOf: [
            { $ref: getSchemaPath(WebHookAuthConfigNone) },
            { $ref: getSchemaPath(WebHookAuthConfigHeader) },
        ],
    })
    @Column("json")
    auth!: WebHookAuthConfigNone | WebHookAuthConfigHeader;
}
