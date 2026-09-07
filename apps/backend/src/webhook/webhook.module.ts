import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { SessionModule } from "../session/session.module.js";
import { OutboundUrlPolicyService } from "./outbound-url-policy.service.js";
import { WebhookService } from "./webhook.service.js";

/**
 * Owns outbound webhook delivery and its SSRF protection policy.
 *
 * Consumers import this module instead of registering their own copies of the
 * providers, ensuring the application uses one shared provider instance.
 */
@Module({
    imports: [HttpModule, SessionModule],
    providers: [WebhookService, OutboundUrlPolicyService],
    exports: [WebhookService, OutboundUrlPolicyService],
})
export class WebhookModule {}
