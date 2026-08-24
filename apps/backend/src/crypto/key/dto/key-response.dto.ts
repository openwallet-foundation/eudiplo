import { ApiProperty } from "@nestjs/swagger";
import { EC_Public } from "../../../issuer/issuance/oid4vci/well-known/dto/jwks-response.dto";

export class KeyResponseDto {
    @ApiProperty({ description: "JSON Web Keys", type: [Object] })
    keys!: EC_Public[];
}
