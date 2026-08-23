import { ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import type {
    ConfigOwnership,
    ConfigResourceKind,
} from "./config-resource.types";
import { ConfigResourceMetadataEntity } from "./entities/config-resource-metadata.entity";

@Injectable()
export class ConfigOwnershipService {
    constructor(
        @InjectRepository(ConfigResourceMetadataEntity)
        private readonly repository: Repository<ConfigResourceMetadataEntity>,
    ) {}

    async get(
        tenantId: string,
        kind: ConfigResourceKind,
        resourceId: string,
    ): Promise<ConfigResourceMetadataEntity> {
        return (
            (await this.repository.findOneBy({ tenantId, kind, resourceId })) ??
            this.repository.create({
                tenantId,
                kind,
                resourceId,
                ownership: "unmanaged",
                generation: 1,
            })
        );
    }

    findStored(
        tenantId: string,
        kind: ConfigResourceKind,
        resourceId: string,
    ): Promise<ConfigResourceMetadataEntity | null> {
        return this.repository.findOneBy({ tenantId, kind, resourceId });
    }

    list(tenantId: string): Promise<ConfigResourceMetadataEntity[]> {
        return this.repository.find({
            where: { tenantId },
            order: { kind: "ASC", resourceId: "ASC" },
        });
    }

    listManagedBySource(
        tenantId: string,
        source: string,
    ): Promise<ConfigResourceMetadataEntity[]> {
        return this.repository.find({
            where: { tenantId, ownership: "file-managed", source },
            order: { kind: "ASC", resourceId: "ASC" },
        });
    }

    async listManagedBySourceScope(
        tenantId: string,
        source: string,
    ): Promise<ConfigResourceMetadataEntity[]> {
        const managed = await this.list(tenantId);
        if (!source.startsWith("folder:")) {
            return managed.filter(
                (entry) =>
                    entry.ownership === "file-managed" &&
                    entry.source === source,
            );
        }
        const folder = source.slice("folder:".length).replace(/[\\/]+$/, "");
        return managed.filter((entry) => {
            if (entry.ownership !== "file-managed" || !entry.source) {
                return false;
            }
            if (entry.source === source) {
                return true;
            }
            return (
                entry.source.startsWith(`${folder}/`) ||
                entry.source.startsWith(`${folder}\\`)
            );
        });
    }

    async markApplied(options: {
        tenantId: string;
        kind: ConfigResourceKind;
        resourceId: string;
        ownership: ConfigOwnership;
        generation?: number;
        source?: string;
        sourceHash?: string;
    }): Promise<ConfigResourceMetadataEntity> {
        const current = await this.get(
            options.tenantId,
            options.kind,
            options.resourceId,
        );
        if (
            options.ownership === "file-managed" &&
            options.generation !== undefined &&
            options.generation < current.generation
        ) {
            throw new ConflictException(
                `${options.kind} '${options.resourceId}' has stale generation ${options.generation}; stored generation is ${current.generation}.`,
            );
        }
        return this.repository.save({
            ...current,
            ...options,
            generation: options.generation ?? current.generation ?? 1,
            lastAppliedAt: new Date(),
        });
    }

    async detach(
        tenantId: string,
        kind: ConfigResourceKind,
        resourceId: string,
    ): Promise<ConfigResourceMetadataEntity> {
        const current = await this.get(tenantId, kind, resourceId);
        return this.repository.save({
            ...current,
            ownership: "unmanaged",
            source: undefined,
            sourceHash: undefined,
            lastAppliedAt: new Date(),
        });
    }

    async assertMutable(
        tenantId: string,
        kind: ConfigResourceKind,
        resourceId: string,
    ): Promise<void> {
        const metadata = await this.repository.findOneBy({
            tenantId,
            kind,
            resourceId,
        });
        if (metadata?.ownership === "file-managed") {
            throw new ConflictException(
                `${kind} '${resourceId}' is file-managed by ${metadata.source ?? "provisioning"}. Detach it before changing it through the API or UI.`,
            );
        }
    }

    async recordApiMutation(
        tenantId: string,
        kind: ConfigResourceKind,
        resourceId: string,
        create: boolean,
    ): Promise<ConfigResourceMetadataEntity> {
        const stored = await this.repository.findOneBy({
            tenantId,
            kind,
            resourceId,
        });
        return this.repository.save({
            ...(stored ?? { tenantId, kind, resourceId }),
            ownership: "unmanaged",
            generation: create && !stored ? 1 : (stored?.generation ?? 1) + 1,
            source: undefined,
            sourceHash: undefined,
        });
    }

    async remove(
        tenantId: string,
        kind: ConfigResourceKind,
        resourceId: string,
    ): Promise<void> {
        await this.repository.delete({ tenantId, kind, resourceId });
    }

    async removeTenant(tenantId: string): Promise<void> {
        await this.repository.delete({ tenantId });
    }
}
