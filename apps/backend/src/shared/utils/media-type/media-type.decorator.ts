import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Decorator to extract the content type from the request headers.
 * This decorator can be used to determine the media type of the request.
 */
export const ContentType = createParamDecorator(
    (data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return request.headers["accept"] as string | undefined;
    },
);
