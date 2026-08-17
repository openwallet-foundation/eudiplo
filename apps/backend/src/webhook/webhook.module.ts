import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { SessionModule } from "../session/session.module";
import { OutboundUrlPolicyService } from "./outbound-url-policy.service";
import { WebhookService } from "./webhook.service";

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
