import { BadRequestException } from "@nestjs/common";
import { PresentationFailureCode } from "../../../session/entities/presentation-failure-code.enum";

export class PresentationVerificationException extends BadRequestException {
    constructor(
        public readonly failureCode: PresentationFailureCode,
        message: string,
    ) {
        super(message);
    }
}
