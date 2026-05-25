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
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status: number;
        if (exception instanceof HttpException) {
            status = exception.getStatus();
        } else if (exception instanceof EntityNotFoundError) {
            status = HttpStatus.NOT_FOUND;
        } else {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }

        let message: unknown;
        if (exception instanceof HttpException) {
            message = exception.getResponse();
        } else if (exception instanceof Error) {
            message = exception.message;
        } else {
            message = "Internal Server Error";
        }

        // Log the error with stack trace if available using NestJS Logger
        this.logger.error(
            `[${request.method}] ${request.url} ${status} - ${JSON.stringify(message)}`,
            exception instanceof Error ? exception.stack : undefined,
        );

        response.status(status).json({
            statusCode: status,
            timestamp: new Date().toISOString(),
            path: request.url,
            message,
        });
    }
}
