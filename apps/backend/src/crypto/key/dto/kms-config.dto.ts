import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsArray,
    IsIn,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUrl,
    ValidateNested,
} from "class-validator";

/**
 * Supported KMS adapter types.
 */
const KMS_PROVIDER_TYPES = [
    "db",
    "vault",
    "aws-kms",
    "pkcs11",
    "http",
] as const;
export type KmsProviderType = (typeof KMS_PROVIDER_TYPES)[number];

/**
 * Base configuration for all KMS providers.
 * Each provider must have a unique id and a type.
 */
class BaseKmsProviderConfigDto {
    @ApiProperty({
        description:
            "Unique identifier for this provider instance. Used when generating keys to specify which provider to use.",
        example: "main-vault",
    })
    @IsString()
    @IsNotEmpty()
    id!: string;

    @ApiProperty({
        description:
            "Type of the KMS provider. Must match a supported adapter type.",
        enum: KMS_PROVIDER_TYPES,
        example: "vault",
    })
    @IsString()
    @IsIn(KMS_PROVIDER_TYPES)
    type!: KmsProviderType;

    @ApiPropertyOptional({
        description: "Human-readable description of this provider instance.",
        example: "Production HashiCorp Vault for signing keys",
    })
    @IsString()
    @IsOptional()
    description?: string;
}

/**
 * Configuration for the DB KMS provider.
 * No additional configuration required — keys are stored in the database.
 */
class DbKmsConfigDto extends BaseKmsProviderConfigDto {
    @ApiProperty({
        description: "Type of the KMS provider.",
        enum: ["db"],
        example: "db",
    })
    @IsIn(["db"])
    declare type: "db";
}

/**
 * Configuration for the HashiCorp Vault KMS provider.
 */
class VaultKmsConfigDto extends BaseKmsProviderConfigDto {
    @ApiProperty({
        description: "Type of the KMS provider.",
        enum: ["vault"],
        example: "vault",
    })
    @IsIn(["vault"])
    declare type: "vault";

    @ApiProperty({
        description:
            "URL of the HashiCorp Vault instance. Supports ${ENV_VAR} placeholders.",
        example: "${VAULT_URL}",
    })
    @IsString()
    @IsNotEmpty()
    vaultUrl!: string;

    @ApiProperty({
        description:
            "Authentication token for HashiCorp Vault. Supports ${ENV_VAR} placeholders.",
        example: "${VAULT_TOKEN}",
    })
    @IsString()
    @IsNotEmpty()
    vaultToken!: string;
}

/**
 * Configuration for the AWS KMS provider.
 * Uses AWS SDK credential chain if credentials are not provided.
 */
class AwsKmsConfigDto extends BaseKmsProviderConfigDto {
    @ApiProperty({
        description: "Type of the KMS provider.",
        enum: ["aws-kms"],
        example: "aws-kms",
    })
    @IsIn(["aws-kms"])
    declare type: "aws-kms";

    @ApiProperty({
        description: "AWS region for KMS. Supports ${ENV_VAR} placeholders.",
        example: "${AWS_REGION}",
    })
    @IsString()
    @IsNotEmpty()
    region!: string;

    @ApiPropertyOptional({
        description:
            "AWS access key ID. Optional — uses SDK credential chain if not provided. Supports ${ENV_VAR} placeholders.",
        example: "${AWS_ACCESS_KEY_ID}",
    })
    @IsString()
    @IsOptional()
    accessKeyId?: string;

    @ApiPropertyOptional({
        description:
            "AWS secret access key. Optional — uses SDK credential chain if not provided. Supports ${ENV_VAR} placeholders.",
        example: "${AWS_SECRET_ACCESS_KEY}",
    })
    @IsString()
    @IsOptional()
    secretAccessKey?: string;
}

/**
 * Configuration for the PKCS#11 KMS provider (HSMs, smart cards, SoftHSM).
 * The native `pkcs11js` module is loaded lazily on first use.
 */
class Pkcs11KmsConfigDto extends BaseKmsProviderConfigDto {
    @ApiProperty({
        description: "Type of the KMS provider.",
        enum: ["pkcs11"],
        example: "pkcs11",
    })
    @IsIn(["pkcs11"])
    declare type: "pkcs11";

    @ApiProperty({
        description:
            "Absolute path to the PKCS#11 module library (.so/.dll/.dylib). Supports ${ENV_VAR} placeholders.",
        example: "${PKCS11_LIBRARY}",
    })
    @IsString()
    @IsNotEmpty()
    library!: string;

    @ApiProperty({
        description:
            "Slot selection. Either the numeric slot index (as a string for ENV interpolation, or a number) or the token label. Supports ${ENV_VAR} placeholders.",
        example: "${PKCS11_SLOT}",
    })
    slot!: number | string;

    @ApiProperty({
        description:
            "User PIN used for C_Login. Supports ${ENV_VAR} placeholders.",
        example: "${PKCS11_PIN}",
    })
    @IsString()
    @IsNotEmpty()
    pin!: string;

    @ApiPropertyOptional({
        description:
            "Open the PKCS#11 session in read-only mode. Defaults to false.",
        example: false,
    })
    @IsOptional()
    readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// HTTP KMS auth sub-DTOs
// ---------------------------------------------------------------------------

const HTTP_AUTH_TYPES = [
    "none",
    "bearer",
    "oauth2-client-credentials",
    "mtls",
] as const;
type HttpAuthType = (typeof HTTP_AUTH_TYPES)[number];

class HttpAuthBaseConfigDto {
    @ApiProperty({
        description: "Authentication method for the remote KMS service.",
        enum: HTTP_AUTH_TYPES,
    })
    @IsIn(HTTP_AUTH_TYPES)
    type!: HttpAuthType;
}

/** No authentication — suitable for services on a trusted private network. */
class HttpAuthNoneConfigDto extends HttpAuthBaseConfigDto {
    declare type: "none";
}

/** Static Bearer token sent as `Authorization: Bearer <token>`. */
class HttpAuthBearerConfigDto extends HttpAuthBaseConfigDto {
    declare type: "bearer";

    @ApiProperty({
        description: "Bearer token value. Supports ${ENV_VAR} placeholders.",
        example: "${KMS_API_KEY}",
    })
    @IsString()
    @IsNotEmpty()
    token!: string;
}

/** OAuth 2.0 Client Credentials — EUDIPLO fetches and caches short-lived tokens. */
class HttpAuthOauth2ConfigDto extends HttpAuthBaseConfigDto {
    declare type: "oauth2-client-credentials";

    @ApiProperty({
        description:
            "Token endpoint URL (e.g. Keycloak, Entra ID). Supports ${ENV_VAR} placeholders.",
        example: "${IAM_TOKEN_URL}",
    })
    @IsUrl({ require_tld: false })
    tokenUrl!: string;

    @ApiProperty({
        description: "OAuth 2.0 client ID. Supports ${ENV_VAR} placeholders.",
        example: "${KMS_CLIENT_ID}",
    })
    @IsString()
    @IsNotEmpty()
    clientId!: string;

    @ApiProperty({
        description:
            "OAuth 2.0 client secret. Supports ${ENV_VAR} placeholders.",
        example: "${KMS_CLIENT_SECRET}",
    })
    @IsString()
    @IsNotEmpty()
    clientSecret!: string;

    @ApiPropertyOptional({
        description:
            "Space-separated list of OAuth 2.0 scopes to request. Optional.",
        example: "kms:sign kms:admin",
    })
    @IsString()
    @IsOptional()
    scope?: string;
}

/** Mutual TLS — EUDIPLO presents a client certificate on every connection. */
class HttpAuthMtlsConfigDto extends HttpAuthBaseConfigDto {
    declare type: "mtls";

    @ApiProperty({
        description:
            "Absolute path to the PEM-encoded client certificate file. Supports ${ENV_VAR} placeholders.",
        example: "/etc/certs/eudiplo.crt",
    })
    @IsString()
    @IsNotEmpty()
    certFile!: string;

    @ApiProperty({
        description:
            "Absolute path to the PEM-encoded private key file for the client certificate. Supports ${ENV_VAR} placeholders.",
        example: "/etc/certs/eudiplo.key",
    })
    @IsString()
    @IsNotEmpty()
    keyFile!: string;

    @ApiPropertyOptional({
        description:
            "Absolute path to the PEM-encoded CA bundle to trust for the remote server's certificate. Omit to use the system CA store.",
        example: "/etc/certs/ca.crt",
    })
    @IsString()
    @IsOptional()
    caFile?: string;
}

type HttpKmsAuthConfigDto =
    | HttpAuthNoneConfigDto
    | HttpAuthBearerConfigDto
    | HttpAuthOauth2ConfigDto
    | HttpAuthMtlsConfigDto;

// ---------------------------------------------------------------------------
// HTTP KMS provider config
// ---------------------------------------------------------------------------

/**
 * Configuration for the HTTP KMS provider.
 * Delegates all key operations to a remote microservice via HTTP/HTTPS.
 */
class HttpKmsConfigDto extends BaseKmsProviderConfigDto {
    @ApiProperty({
        description: "Type of the KMS provider.",
        enum: ["http"],
        example: "http",
    })
    @IsIn(["http"])
    declare type: "http";

    @ApiProperty({
        description:
            "Base URL of the remote KMS microservice (no trailing slash). Supports ${ENV_VAR} placeholders.",
        example: "${KMS_SERVICE_URL}",
    })
    @IsString()
    @IsNotEmpty()
    baseUrl!: string;

    @ApiPropertyOptional({
        description:
            'Authentication method for the remote KMS service. Supports bearer token, OAuth 2.0 client credentials, and mutual TLS. Omit (or set type to "none") for unauthenticated services.',
        type: () => HttpAuthBaseConfigDto,
    })
    @IsOptional()
    @ValidateNested()
    @Type(() => HttpAuthBaseConfigDto, {
        discriminator: {
            property: "type",
            subTypes: [
                { value: HttpAuthNoneConfigDto, name: "none" },
                { value: HttpAuthBearerConfigDto, name: "bearer" },
                {
                    value: HttpAuthOauth2ConfigDto,
                    name: "oauth2-client-credentials",
                },
                { value: HttpAuthMtlsConfigDto, name: "mtls" },
            ],
        },
        keepDiscriminatorProperty: true,
    })
    auth?: HttpKmsAuthConfigDto;

    @ApiPropertyOptional({
        description:
            "Path prefix for key endpoints on the remote service. Defaults to /keys.",
        example: "/v1/keys",
    })
    @IsString()
    @IsOptional()
    keysPath?: string;

    @ApiPropertyOptional({
        description:
            "Path for the health check endpoint on the remote service. Defaults to /health.",
        example: "/health",
    })
    @IsString()
    @IsOptional()
    healthPath?: string;

    @ApiPropertyOptional({
        description:
            "Whether the remote service supports key import via POST {keysPath}/{kid}/import. Defaults to false.",
        example: false,
    })
    @IsOptional()
    canImport?: boolean;
}

/**
 * Union type for all provider configurations.
 */
export type KmsProviderConfigDto =
    | DbKmsConfigDto
    | VaultKmsConfigDto
    | AwsKmsConfigDto
    | Pkcs11KmsConfigDto
    | HttpKmsConfigDto;

/**
 * Root DTO for kms.json.
 *
 * Providers are configured as an array of provider instances.
 * Each provider has a unique `id` that can be referenced when generating keys,
 * a `type` that determines which adapter to use, and optional `description`.
 *
 * Example:
 * ```json
 * {
 *   "defaultProvider": "main-vault",
 *   "providers": [
 *     { "id": "db", "type": "db", "description": "Default database provider" },
 *     { "id": "main-vault", "type": "vault", "description": "Production Vault", "vaultUrl": "${VAULT_URL}", "vaultToken": "${VAULT_TOKEN}" },
 *     { "id": "backup-vault", "type": "vault", "description": "Backup Vault", "vaultUrl": "${BACKUP_VAULT_URL}", "vaultToken": "${BACKUP_VAULT_TOKEN}" },
 *     { "id": "aws", "type": "aws-kms", "description": "AWS KMS", "region": "${AWS_REGION}" }
 *   ]
 * }
 * ```
 */
export class KmsConfigDto {
    @ApiPropertyOptional({
        description:
            'ID of the default KMS provider. Defaults to "db" if not set.',
        example: "main-vault",
    })
    @IsString()
    @IsOptional()
    defaultProvider?: string;

    @ApiProperty({
        description:
            "List of KMS provider configurations. Each provider must have a unique id and a type.",
        type: [BaseKmsProviderConfigDto],
        example: [
            { id: "db", type: "db", description: "Default database provider" },
            {
                id: "main-vault",
                type: "vault",
                description: "Production Vault",
                vaultUrl: "${VAULT_URL}",
                vaultToken: "${VAULT_TOKEN}",
            },
            {
                id: "aws",
                type: "aws-kms",
                description: "AWS KMS",
                region: "${AWS_REGION}",
            },
        ],
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => BaseKmsProviderConfigDto, {
        discriminator: {
            property: "type",
            subTypes: [
                { value: DbKmsConfigDto, name: "db" },
                { value: VaultKmsConfigDto, name: "vault" },
                { value: AwsKmsConfigDto, name: "aws-kms" },
                { value: Pkcs11KmsConfigDto, name: "pkcs11" },
                { value: HttpKmsConfigDto, name: "http" },
            ],
        },
        keepDiscriminatorProperty: true,
    })
    providers!: KmsProviderConfigDto[];
}
