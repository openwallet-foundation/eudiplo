import { Type } from "class-transformer";
import {
    IsArray,
    IsDefined,
    IsIn,
    IsOptional,
    IsString,
    ValidateNested,
} from "class-validator";
import {
    ClaimsQuery,
    CredentialQuery,
    CredentialQueryDcSdJwt,
    CredentialQueryMsoMdoc,
    CredentialQueryValue,
    CredentialSetQuery,
} from "../../../../verifier/presentations/entities/presentation-config.entity";

export class EmbeddedDisclosurePolicy {
    @IsString()
    policy!: string;
}

/** allowList */
export class AllowListPolicy extends EmbeddedDisclosurePolicy {
    @IsString()
    @IsIn(["allowList"])
    declare policy: "allowList";

    @IsDefined()
    @IsString({ each: true })
    values!: string[];
}

/** rootOfTrust */
export class RootOfTrustPolicy extends EmbeddedDisclosurePolicy {
    @IsString()
    @IsIn(["rootOfTrust"])
    declare policy: "rootOfTrust";

    // adapt as needed if you want an array instead
    @IsDefined()
    @IsString()
    values!: string;
}

/** none */
export class NoneTrustPolicy extends EmbeddedDisclosurePolicy {
    @IsString()
    @IsIn(["none"])
    declare policy: "none";
}
/** attestationBased */
export class PolicyCredential {
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ClaimsQuery)
    claims?: ClaimsQuery[];

    @IsDefined()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CredentialQuery, {
        discriminator: {
            property: "format",
            subTypes: [
                { value: CredentialQueryDcSdJwt, name: "dc+sd-jwt" },
                { value: CredentialQueryMsoMdoc, name: "mso_mdoc" },
            ],
        },
        keepDiscriminatorProperty: true,
    })
    credentials!: CredentialQueryValue[];

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CredentialSetQuery)
    credential_sets?: CredentialSetQuery[];
}

export class AttestationBasedPolicy extends EmbeddedDisclosurePolicy {
    @IsString()
    @IsIn(["attestationBased"])
    declare policy: "attestationBased";

    @IsDefined()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PolicyCredential)
    values!: PolicyCredential[];
}
