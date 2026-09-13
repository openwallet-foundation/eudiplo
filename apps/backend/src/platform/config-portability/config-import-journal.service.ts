import { randomUUID } from "node:crypto";
import {
    ConflictException,
    HttpException,
    Injectable,
    NotFoundException,
    ServiceUnavailableException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigImportRunEntity } from "./entities/config-import-run.entity.js";

@Injectable()
export class ConfigImportJournalService {
    private readonly executing = new Set<string>();
    constructor(
        @InjectRepository(ConfigImportRunEntity)
        private readonly repository: Repository<ConfigImportRunEntity>,
    ) {}

    async run<T>(
        tenantId: string,
        mode: string,
        execute: (run: ConfigImportRunEntity) => Promise<T>,
    ): Promise<T> {
        const run = this.repository.create({
            id: randomUUID(),
            tenantId,
            activeTenant: tenantId,
            mode,
            status: "running",
            operations: [],
            planFingerprint: null,
        });
        try {
            await this.repository.insert(run);
        } catch (error) {
            const active = await this.repository.findOneBy({
                activeTenant: tenantId,
            });
            if (active)
                throw new ConflictException({
                    code: "CONFIG_WRITER_ACTIVE",
                    message:
                        "A configuration operation is running or needs recovery",
                    operationId: active.id,
                });
            throw error;
        }
        this.executing.add(run.id);
        try {
            let result: T;
            try {
                result = await execute(run);
            } catch (error) {
                try {
                    await this.finish(run, "failed");
                } catch {
                    throw this.persistenceFailure(run, error);
                }
                throw error;
            }
            try {
                await this.finish(run, "completed");
            } catch {
                throw this.persistenceFailure(run, result);
            }
            return result;
        } finally {
            this.executing.delete(run.id);
        }
    }

    private persistenceFailure(run: ConfigImportRunEntity, result: unknown) {
        const response =
            result instanceof HttpException ? result.getResponse() : result;
        const generatedSecrets =
            response &&
            typeof response === "object" &&
            "generatedSecrets" in response
                ? response.generatedSecrets
                : undefined;
        return new ServiceUnavailableException({
            code: "CONFIG_JOURNAL_WRITE_FAILED",
            operationId: run.id,
            message:
                "Could not finalize the configuration journal. Inspect the operation and target state before retrying; its tenant lock may still be held.",
            operations: run.operations,
            ...(Array.isArray(generatedSecrets) ? { generatedSecrets } : {}),
        });
    }

    async checkpoint(run: ConfigImportRunEntity): Promise<void> {
        const result = await this.repository.update(
            {
                id: run.id,
                tenantId: run.tenantId,
                status: "running",
                activeTenant: run.tenantId,
            },
            {
                operations: run.operations,
                planFingerprint: run.planFingerprint,
            },
        );
        if (result.affected !== 1)
            throw new ConflictException(
                "Configuration operation no longer owns its tenant lock",
            );
    }

    private async finish(
        run: ConfigImportRunEntity,
        status: "completed" | "failed",
    ) {
        const result = await this.repository.update(
            {
                id: run.id,
                tenantId: run.tenantId,
                status: "running",
                activeTenant: run.tenantId,
            },
            { status, activeTenant: null, operations: run.operations },
        );
        if (result.affected !== 1)
            throw new ConflictException(
                "Configuration operation was interrupted",
            );
    }

    list(tenantId: string) {
        return this.repository.find({
            where: { tenantId },
            order: { createdAt: "DESC" },
            take: 50,
        });
    }
    async get(tenantId: string, id: string) {
        const run = await this.repository.findOneBy({ tenantId, id });
        if (!run)
            throw new NotFoundException("Configuration operation not found");
        return run;
    }
    /** Operator must stop the original worker before acknowledging an interrupted run. */
    async acknowledgeInterruption(tenantId: string, id: string) {
        const run = await this.get(tenantId, id);
        if (run.status !== "running") return run;
        if (this.executing.has(id))
            throw new ConflictException(
                "This worker is still executing the operation",
            );
        const result = await this.repository.update(
            {
                tenantId,
                id,
                status: "running",
                activeTenant: tenantId,
                revision: run.revision,
            },
            { status: "interrupted", activeTenant: null },
        );
        if (result.affected !== 1)
            throw new ConflictException(
                "Operation progressed; inspect it again before recovery",
            );
        return this.get(tenantId, id);
    }
}
