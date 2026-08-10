import { EC_Public } from "../../../issuer/issuance/oid4vci/well-known/dto/jwks-response.dto";
import { ApiProperty } from "@nestjs/swagger";

export class KeyResponseDto {
    @ApiProperty({ description: "JSON Web Keys", type: [Object] })
    keys!: EC_Public[];
}
