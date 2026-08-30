import { createZodDto } from "nestjs-zod";
import { ActiveCredentialPolicySchema } from "../schemas/credential-config.schema";

/**
 * Issuer-side policy limiting how many credentials of a given configuration a
 * single subject may hold active at once (issue #843).
 *
 * This is distinct from `credentialReusePolicy`, which is metadata published to
 * wallets per ETSI TS 119 472-3 describing how a credential may be reused when
 * presenting to a relying party. This policy is enforced by the issuer: when a
 * new credential is issued to a subject, that subject's previously issued
 * credentials for the same configuration are revoked.
 */
export class ActiveCredentialPolicy extends createZodDto(
    ActiveCredentialPolicySchema,
) {}
