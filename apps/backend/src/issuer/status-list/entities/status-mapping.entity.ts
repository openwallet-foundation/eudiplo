import { Column, Entity, JoinColumn, ManyToOne, Unique } from "typeorm";
import { TenantEntity } from "../../../auth/tenant/entities/tenant.entity";
import { StatusListEntity } from "./status-list.entity";

@Entity()
@Unique("UQ_status_mapping_tenant_list_index", [
    "tenantId",
    "statusListId",
    "index",
])
export class StatusMapping {
    @Column({ type: "varchar", primary: true })
    tenantId!: string;

    /**
     * The tenant that owns this object.
     */
    @ManyToOne(() => TenantEntity, { cascade: true, onDelete: "CASCADE" })
    tenant!: TenantEntity;

    @Column({ type: "varchar", primary: true })
    sessionId!: string;

    /**
     * The ID of the status list this mapping belongs to.
     */
    @Column({ type: "varchar", primary: true })
    statusListId!: string;

    /**
     * The status list entity.
     */
    @ManyToOne(() => StatusListEntity, { onDelete: "CASCADE" })
    @JoinColumn([
        { name: "statusListId", referencedColumnName: "id" },
        { name: "tenantId", referencedColumnName: "tenantId" },
    ])
    statusList!: StatusListEntity;

    /**
     * The full URI of the status list (for backward compatibility and quick lookups).
     */
    @Column({ type: "varchar" })
    list!: string;

    @Column({ type: "int", primary: true })
    index!: number;

    @Column({ type: "varchar", primary: true })
    credentialConfigurationId!: string;
}
