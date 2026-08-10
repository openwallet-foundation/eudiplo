import { ApiProperty } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const DeferredCredentialRequestSchema = z
    .object({
        transaction_id: z.string(),
    })
    .strict();

/**
 * DTO for the Deferred Credential Request.
 *
 * According to OID4VCI Section 9.1, the request MUST include a `transaction_id`
 * that was previously returned by the Credential Endpoint.
 *
 * @see https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#name-deferred-credential-request
 */
export class DeferredCredentialRequestDto extends createZodDto(
    DeferredCredentialRequestSchema,
) {
    /**
     * The transaction identifier returned by the Credential Endpoint.
     */
    @ApiProperty({
        description:
            "The transaction identifier previously returned by the Credential Endpoint",
        example: "8xLOxBtZp8",
    })
    transaction_id!: string;
}
