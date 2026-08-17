import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { TenantEntity } from "../../auth/tenant/entities/tenant.entity";

/**
 * Typed defaults for registrar registration certificate creation.
 * These values are merged into presentation-specific registration certificate bodies.
 */
export class RegistrationCertificateDefaults {
    @ApiPropertyOptional({
        description:
            "Default privacy policy URL for registration certificate creation.",
        example: "https://verifier.example/privacy",
    })
    privacy_policy?: string;

    @ApiPropertyOptional({
        description:
            "Default support contact URI for registration certificate creation.",
        example: "mailto:support@verifier.example",
    })
    support_uri?: string;
}

/**
 * Stores the configuration for connecting to an external registrar service.
 * Each tenant can have their own registrar configuration with OIDC credentials.
 *
 * Note: Credentials are stored in plaintext for ease of use without the client.
 * For production environments with higher security requirements, consider
 * using a secrets manager like HashiCorp Vault.
 */
@Entity()
export class RegistrarConfigEntity {
    /**
     * The tenant ID this configuration belongs to.
     */
    @PrimaryColumn("varchar")
    tenantId!: string;

    /**
     * The tenant that owns this configuration.
     */
    @ManyToOne(() => TenantEntity, { cascade: true, onDelete: "CASCADE" })
    tenant!: TenantEntity;

    /**
     * The base URL of the registrar API.
     * Example: https://sandbox.eudi-wallet.org/api
     */
    @ApiProperty({
        description: "The base URL of the registrar API",
        example: "https://sandbox.eudi-wallet.org/api",
    })
    @Column("varchar")
    registrarUrl!: string;

    /**
     * The OIDC issuer URL for authentication.
     * This is typically the Keycloak realm URL.
     * Example: https://auth.example.com/realms/my-realm
     */
    @ApiProperty({
        description:
            "The OIDC issuer URL for authentication (e.g., Keycloak realm URL)",
        example: "https://auth.example.com/realms/my-realm",
    })
    @Column("varchar")
    oidcUrl!: string;

    /**
     * The OIDC client ID for the registrar.
     * This is typically provided by the registrar service.
     */
    @ApiProperty({
        description: "The OIDC client ID for the registrar",
        example: "registrar-client",
    })
    @Column("varchar")
    clientId!: string;

    /**
     * The OIDC client secret (optional, for confidential clients).
     */
    @ApiPropertyOptional({
        description:
            "The OIDC client secret (optional, for confidential clients)",
    })
    @Column("varchar", { nullable: true })
    clientSecret?: string;

    /**
     * The username for OIDC Resource Owner Password Credentials (ROPC) flow.
     */
    @ApiProperty({
        description: "The username for OIDC login",
        example: "admin@example.com",
    })
    @Column("varchar")
    username!: string;

    /**
     * The password for OIDC Resource Owner Password Credentials (ROPC) flow.
     * Note: Stored in plaintext for ease of use. Use a secrets manager for production.
     */
    @ApiProperty({
        description: "The password for OIDC login (stored in plaintext)",
    })
    @Column("varchar")
    password!: string;

    /**
     * Optional tenant-wide defaults merged into registration certificate creation requests.
     * Presentation config values take precedence over these defaults.
     */
    @ApiPropertyOptional({
        description:
            "Optional default values merged into registration certificate creation requests (for example privacy_policy, support_uri)",
        type: () => RegistrationCertificateDefaults,
        additionalProperties: true,
    })
    @Column("json", { nullable: true })
    registrationCertificateDefaults?: RegistrationCertificateDefaults | null;
}
