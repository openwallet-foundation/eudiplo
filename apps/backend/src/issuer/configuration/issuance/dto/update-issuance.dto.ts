import { PartialType } from "@nestjs/swagger";
import { IssuanceDto } from "./issuance.dto";

/**
 * DTO for partial issuance configuration updates.
 * Validation of required runtime invariants happens after merge in the service.
 */
export class UpdateIssuanceDto extends PartialType(IssuanceDto) {}
