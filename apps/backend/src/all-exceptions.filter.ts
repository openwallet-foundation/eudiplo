import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { EntityNotFoundError } from "typeorm";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const isProduction = process.env.NODE_ENV === "production";
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();
        const requestPath = request.path || request.url.split("?")[0] || "/";

        let status: number;
        if (exception instanceof HttpException) {
            status = exception.getStatus();
        } else if (exception instanceof EntityNotFoundError) {
            status = HttpStatus.NOT_FOUND;
        } else {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }

        let message: unknown;
        let responseBody: Record<string, unknown> | undefined;
        if (exception instanceof HttpException) {
            const httpResponse = exception.getResponse();
            if (typeof httpResponse === "string") {
                message = httpResponse;
            } else if (
                httpResponse &&
                typeof httpResponse === "object" &&
                !Array.isArray(httpResponse)
            ) {
                responseBody = httpResponse as Record<string, unknown>;
                message = responseBody.message;
            } else {
                message = httpResponse;
            }
        } else if (exception instanceof Error && !isProduction) {
            message = exception.message;
        } else {
            message = "Internal Server Error";
        }

        const validationDetails =
            responseBody && typeof responseBody.errors !== "undefined"
                ? JSON.stringify(responseBody.errors, null, 2)
                : undefined;

        // Log the error with stack trace and validation details if available.
        this.logger.error(
            `[${request.method}] ${requestPath} ${status} - ${JSON.stringify(message)}${
                validationDetails ? ` | Details: ${validationDetails}` : ""
            }`,
            exception instanceof Error ? exception.stack : undefined,
        );

        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: requestPath,
            ...(responseBody ?? {}),
            message,
        });
    }
}
