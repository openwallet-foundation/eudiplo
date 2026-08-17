import { Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { TenantEntity } from "../../auth/tenant/entities/tenant.entity";

@Entity()
export class FileEntity {
    /**
     * The ID of the object.
     */
    @PrimaryColumn()
    id!: string;

    @Column()
    filename!: string;

    /**
     * Tenant ID for the key.
     */
    @Column("varchar", { primary: true })
    tenantId!: string;

    /**
     * The tenant that owns this object.
     */
    @ManyToOne(() => TenantEntity, { cascade: true, onDelete: "CASCADE" })
    tenant!: TenantEntity;
}
