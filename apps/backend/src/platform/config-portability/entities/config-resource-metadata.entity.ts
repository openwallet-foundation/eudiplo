import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryColumn,
    UpdateDateColumn,
} from "typeorm";
import type {
    ConfigOwnership,
    ConfigResourceKind,
} from "../config-resource.types";

@Entity("config_resource_metadata")
@Index(["tenantId", "ownership"])
export class ConfigResourceMetadataEntity {
    @PrimaryColumn("varchar")
    tenantId!: string;

    @PrimaryColumn("varchar")
    kind!: ConfigResourceKind;

    @PrimaryColumn("varchar")
    resourceId!: string;

    @Column("varchar", { default: "unmanaged" })
    ownership!: ConfigOwnership;

    @Column("int", { default: 1 })
    generation!: number;

    @Column("varchar", { nullable: true })
    source?: string;

    @Column("varchar", { nullable: true })
    sourceHash?: string;

    @Column({ nullable: true })
    lastAppliedAt?: Date;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
