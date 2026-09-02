import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
    VersionColumn,
} from "typeorm";
import { TenantEntity } from "../../../auth/tenant/entities/tenant.entity";

/**
 * Tracks the currently active issuance for a subject under one credential
 * configuration, for the active-credential-limit policy (issue #843).
 *
 * There is at most one row per (tenant, credential configuration, subject),
 * enforced by a database unique constraint. That constraint — not application
 * logic — is what makes concurrent first issuances safe: two simultaneous
 * requests for the same subject cannot both insert a slot, so one loses and
 * retries against the winner's row.
 *
 * The subject is stored only as `subjectScopedKey`, a pseudonymous HMAC of the
 * authorization identity scoped per tenant and credential configuration. The
 * raw `iss`/`sub` are never persisted, and the same person's slots for two
 * different credential configurations are not linkable through this column.
 *
 * Status mappings reference issuances by the opaque `issuanceSetId` rather than
 * by subject, so the historical mapping table carries no subject-derived value.
 */
@Entity()
@Unique("UQ_active_credential_slot_subject", [
    "tenantId",
    "credentialConfigurationId",
    "subjectScopedKey",
])
export class ActiveCredentialSlot {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar" })
    tenantId!: string;

    /**
     * The tenant that owns this slot.
     */
    @ManyToOne(() => TenantEntity, { onDelete: "CASCADE" })
    tenant!: TenantEntity;

    /**
     * The credential configuration this slot applies to. The policy is
     * configuration-scoped, so a subject may hold one active credential per
     * configuration.
     */
    @Column({ type: "varchar" })
    credentialConfigurationId!: string;

    /**
     * Pseudonymous, per-(tenant, credential-configuration) HMAC of the
     * authorization identity (iss + sub). Never the raw subject.
     */
    @Column({ type: "varchar" })
    subjectScopedKey!: string;

    /**
     * Opaque identifier of the issuance set currently active for this subject.
     * Status mappings created for that issuance carry the same value, which is
     * how the previously active entries are found and revoked on replacement.
     */
    @Column({ type: "varchar", nullable: true })
    issuanceSetId?: string | null;

    /**
     * Optimistic locking version, matching the pattern used by
     * {@link StatusListEntity}. Guards the read-modify-write of a slot that
     * already exists.
     */
    @VersionColumn()
    version!: number;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
