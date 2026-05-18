import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsArray,
    IsBoolean,
    IsIn,
    IsObject,
    IsOptional,
    IsString,
    ValidateNested,
} from "class-validator";

export class FieldDisplayDto {
    @ApiProperty({ description: "Locale code", example: "en-US" })
    @IsString()
    lang!: string;

    @ApiProperty({ description: "Display label", example: "Given Name" })
    @IsString()
    label!: string;

    @ApiPropertyOptional({
        description: "Optional display description",
        example: "Primary first name",
    })
    @IsOptional()
    @IsString()
    description?: string;
}

export class ClaimFieldDefinitionDto {
    @ApiProperty({
        description: "Path to claim value",
        example: ["address", "locality"],
        type: "array",
        items: {
            oneOf: [{ type: "string" }, { type: "number" }, { type: "null" }],
        },
    })
    @IsArray()
    path!: Array<string | number | null>;

    @ApiProperty({
        description: "Claim value type",
        enum: [
            "string",
            "number",
            "integer",
            "boolean",
            "object",
            "array",
            "date",
        ],
    })
    @IsString()
    @IsIn(["string", "number", "integer", "boolean", "object", "array", "date"])
    type!:
        | "string"
        | "number"
        | "integer"
        | "boolean"
        | "object"
        | "array"
        | "date";

    @ApiPropertyOptional({
        description: "Default value",
        oneOf: [
            { type: "string" },
            { type: "number" },
            { type: "boolean" },
            { type: "object", additionalProperties: true },
            { type: "array", items: {} },
            { type: "null" },
        ],
    })
    @IsOptional()
    defaultValue?: unknown;

    @ApiPropertyOptional({ description: "Whether claim is mandatory" })
    @IsOptional()
    @IsBoolean()
    mandatory?: boolean;

    @ApiPropertyOptional({
        description: "Whether claim is disclosable in SD-JWT",
    })
    @IsOptional()
    @IsBoolean()
    disclosable?: boolean;

    @ApiPropertyOptional({
        description: "Namespace for mDOC field",
        example: "eu.europa.ec.eudi.pid.1",
    })
    @IsOptional()
    @IsString()
    namespace?: string;

    @ApiPropertyOptional({ type: () => [FieldDisplayDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FieldDisplayDto)
    display?: FieldDisplayDto[];

    @ApiPropertyOptional({
        description: "Additional JSON schema constraints for this field",
        type: Object,
    })
    @IsOptional()
    @IsObject()
    constraints?: Record<string, unknown>;
}
