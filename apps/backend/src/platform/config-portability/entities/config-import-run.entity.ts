import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryColumn,
    UpdateDateColumn,
    VersionColumn,
} from "typeorm";
import type { ConfigApplyOperation } from "../config-resource.types.js";

@Entity("config_import_run")
@Index(["tenantId", "createdAt"])
export class ConfigImportRunEntity {
    @PrimaryColumn("varchar") id!: string;
    @Column("varchar") tenantId!: string;
    @Column("varchar") mode!: string;
    @Column("varchar", { nullable: true }) planFingerprint!: string | null;
    @Column("varchar") status!:
        | "running"
        | "completed"
        | "failed"
        | "interrupted";
    // A unique, nullable column serializes config writers across server replicas.
    // It is deliberately not a lease: a slow external call must not lose its lock.
    @Column("varchar", { nullable: true, unique: true }) activeTenant!:
        | string
        | null;
    @Column("json") operations!: ConfigApplyOperation[];
    @VersionColumn() revision!: number;
    @CreateDateColumn() createdAt!: Date;
    @UpdateDateColumn() updatedAt!: Date;
}
