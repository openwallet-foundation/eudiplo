import {
    BadRequestException,
    Injectable,
    ValidationError,
    ValidationPipe,
    type ArgumentMetadata,
    type PipeTransform,
    type ValidationPipeOptions,
} from "@nestjs/common";
import {
    createZodValidationPipe,
    type ZodValidationException,
} from "nestjs-zod";
import { isZodDto } from "nestjs-zod/dto";
import {
    buildValidationBody,
    type ValidationIssue,
} from "../zod/zod-schema.util";

function classValidatorErrorsToIssues(
    errors: ValidationError[],
    parentPath: Array<string | number> = [],
): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const error of errors) {
        const path = [...parentPath, error.property];

        if (error.constraints) {
            for (const message of Object.values(error.constraints)) {
                issues.push({
                    path,
                    message,
                    code: "class_validator",
                });
            }
        }

        if (error.children?.length) {
            issues.push(...classValidatorErrorsToIssues(error.children, path));
        }
    }

    return issues;
}

function zodErrorToIssues(error: unknown): ValidationIssue[] {
    const zodError =
        (error as ZodValidationException | undefined)?.getZodError?.() ?? error;

    if (Array.isArray(zodError)) {
        return zodError.map((issue: any) => ({
            path: issue.path ?? [],
            message: issue.message ?? "Invalid value",
            code: issue.code ?? "custom",
        }));
    }

    const issues = (
        zodError as
            | {
                  issues?: Array<{
                      path: Array<string | number>;
                      message: string;
                      code: string;
                  }>;
              }
            | undefined
    )?.issues;
    if (!Array.isArray(issues)) {
        return [];
    }

    return issues.map((issue) => ({
        path: issue.path,
        message: issue.message,
        code: issue.code,
    }));
}

const ZodValidationPipeClass = createZodValidationPipe({
    createValidationException: (error) =>
        new BadRequestException(buildValidationBody(zodErrorToIssues(error))),
});

@Injectable()
export class HybridValidationPipe implements PipeTransform {
    private readonly classValidationPipe: ValidationPipe;
    private readonly zodValidationPipe: PipeTransform;

    constructor(options: ValidationPipeOptions = {}) {
        this.classValidationPipe = new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidUnknownValues: false,
            forbidNonWhitelisted: false,
            stopAtFirstError: false,
            validateCustomDecorators: true,
            validationError: {
                target: false,
                value: false,
            },
            ...options,
            exceptionFactory: (errors) =>
                new BadRequestException(
                    buildValidationBody(classValidatorErrorsToIssues(errors)),
                ),
        });
        this.zodValidationPipe = new ZodValidationPipeClass();
    }

    transform(value: unknown, metadata: ArgumentMetadata) {
        if (isZodDto(metadata.metatype)) {
            return this.zodValidationPipe.transform(value, metadata);
        }

        return this.classValidationPipe.transform(value, metadata);
    }
}

export function createHybridValidationPipe(
    options: ValidationPipeOptions = {},
) {
    return new HybridValidationPipe(options);
}
