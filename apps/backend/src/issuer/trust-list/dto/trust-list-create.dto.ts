import {
    ApiExtraModels,
    ApiProperty,
    getSchemaPath,
    OmitType,
} from "@nestjs/swagger";
import { TrustList } from "../entities/trust-list.entity";

/**
 * Entity information for certificates (metadata for TEInformation)
 */
export class TrustListEntityInfo {
    name!: string;

    lang?: string;

    uri?: string;

    country?: string;

    locality?: string;

    postalCode?: string;

    streetAddress?: string;

    contactUri?: string;
}

/**
 * Internal trust list entity - references certificates already in the system
 */
class InternalTrustListEntity {
    @ApiProperty({ enum: ["internal"] })
    type!: "internal";

    issuerKeyChainId!: string;

    revocationKeyChainId!: string;

    info!: TrustListEntityInfo;
}

/**
 * External trust list entity - uses PEM certificates directly
 */
class ExternalTrustListEntity {
    @ApiProperty({ enum: ["external"] })
    type!: "external";

    issuerCertPem!: string;

    revocationCertPem!: string;

    info!: TrustListEntityInfo;
}

export type TrustListEntity = InternalTrustListEntity | ExternalTrustListEntity;

/**
 * DTO for creating a new Trust List, omitting tenant-related and auto-generated fields.
 */
@ApiExtraModels(InternalTrustListEntity, ExternalTrustListEntity)
export class TrustListCreateDto extends OmitType(TrustList, [
    "tenant",
    "tenantId",
    "jwt",
    "keyChain",
    "keyChainId",
    "sequenceNumber",
    "createdAt",
    "updatedAt",
    "entityConfig",
    "id",
] as const) {
    id?: string;

    description?: string;

    keyChainId?: string;

    @ApiProperty({
        type: "array",
        items: {
            oneOf: [
                { $ref: getSchemaPath(InternalTrustListEntity) },
                { $ref: getSchemaPath(ExternalTrustListEntity) },
            ],
            discriminator: {
                propertyName: "type",
                mapping: {
                    internal: getSchemaPath(InternalTrustListEntity),
                    external: getSchemaPath(ExternalTrustListEntity),
                },
            },
        },
    })
    entities!: TrustListEntity[];
}
