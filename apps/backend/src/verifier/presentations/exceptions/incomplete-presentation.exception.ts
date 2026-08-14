import { PresentationFailureCode } from "../../../session/entities/presentation-failure-code.enum";
import { PresentationVerificationException } from "./presentation-verification.exception";

/**
 * Exception thrown when a presentation response does not satisfy the DCQL query requirements.
 * This includes missing credentials, missing claims, or unsatisfied credential sets.
 */
export class IncompletePresentationException extends PresentationVerificationException {
    constructor(
        message: string,
        public readonly details?: {
            missingCredentials?: string[];
            missingClaims?: Record<string, string[]>;
            unsatisfiedCredentialSets?: number[];
        },
    ) {
        super(
            PresentationFailureCode.PresentationRequirementsNotSatisfied,
            message,
        );
    }
}
