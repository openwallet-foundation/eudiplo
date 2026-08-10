import { createZodDto } from "nestjs-zod";
import { z } from "zod";
import {
    ClaimsQuery,
    CredentialQueryValue,
    CredentialSetQuery,
} from "../../../../verifier/presentations/entities/presentation-config.entity";

const EmbeddedDisclosurePolicySchema = z
    .object({
        policy: z.string(),
    })
    .strict();

const PolicyCredentialSchema = z
    .object({
        claims: z.array(z.any()).optional(),
        credentials: z.array(z.any()),
        credential_sets: z.array(z.any()).optional(),
    })
    .strict();

const AttestationBasedPolicySchema = z
    .object({
        policy: z.literal("attestationBased"),
        values: z.array(PolicyCredentialSchema),
    })
    .strict();

export class EmbeddedDisclosurePolicy extends createZodDto(
    EmbeddedDisclosurePolicySchema,
) {
    policy!: string;
}

/** allowList */
export class AllowListPolicy extends EmbeddedDisclosurePolicy {
    declare policy: "allowList";

    values!: string[];
}

/** rootOfTrust */
export class RootOfTrustPolicy extends EmbeddedDisclosurePolicy {
    declare policy: "rootOfTrust";

    // adapt as needed if you want an array instead
    values!: string;
}

/** none */
export class NoneTrustPolicy extends EmbeddedDisclosurePolicy {
    declare policy: "none";
}
/** attestationBased */
export class PolicyCredential extends createZodDto(PolicyCredentialSchema) {
    claims?: ClaimsQuery[];

    credentials!: CredentialQueryValue[];

    credential_sets?: CredentialSetQuery[];
}

export class AttestationBasedPolicy extends createZodDto(
    AttestationBasedPolicySchema,
) {
    declare policy: "attestationBased";

    values!: PolicyCredential[];
}
