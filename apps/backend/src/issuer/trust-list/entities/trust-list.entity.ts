import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    UpdateDateColumn,
} from "typeorm";
import { TenantEntity } from "../../../auth/tenant/entitites/tenant.entity";
import { KeyChainEntity } from "../../../crypto/key/entities/key-chain.entity";
import type { TrustListEntity } from "../dto/trust-list-create.dto";

/**
 * Entity representing a Trust List used for credential verification.
 */
@Entity()
export class TrustList {
    /**
     * Unique identifier for the trust list
     * */
    @Column("varchar", { primary: true })
    id!: string;

    @Column("varchar", { nullable: true })
    description?: string;

    /**
     * The tenant ID for which the VP request is made.
     */
    @Column("varchar", { primary: true })
    tenantId!: string;

    /**
     * The tenant that owns this object.
     */
    @ManyToOne(() => TenantEntity, { cascade: true, onDelete: "CASCADE" })
    tenant!: TenantEntity;

    @Column("varchar")
    keyChainId!: string;

    @ManyToOne(() => KeyChainEntity, {
        cascade: true,
        onDelete: "CASCADE",
    })
    @JoinColumn([
        { name: "keyChainId", referencedColumnName: "id" },
        { name: "tenantId", referencedColumnName: "tenantId" },
    ])
    keyChain!: KeyChainEntity;

    /**
     * The full trust list JSON (generated LoTE structure)
     */
    @Column({ type: "json", nullable: true })
    data?: object;

    /**
     * The original entity configuration used to create this trust list.
     * Stored for round-tripping when editing.
     */
    @Column({ type: "json", nullable: true })
    entityConfig?: TrustListEntity[];

    /**
     * The sequence number for versioning (incremented on updates)
     */
    @Column({ type: "int", default: 1 })
    sequenceNumber!: number;

    /**
     * The signed JWT representation of this trust list
     */
    @Column({ type: "varchar" })
    jwt!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
