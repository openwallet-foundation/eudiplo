import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
    Session,
    SessionStatus,
} from "../../../session/entities/session.entity";
import { SessionService } from "../../../session/session.service";
import { FlowType } from "./dto/offer-request.dto";
import { CredentialRequestException } from "./exceptions";
import { AuthorizeService } from "./authorization/authorize/authorize.service";
import { AuthorizationServersService } from "./authorization/authorization-servers/authorization-servers.service";

export type OAuth2TokenPayload = {
    [x: string]: unknown;
    iss: string;
    exp: number;
    iat: number;
    aud: string | string[];
    sub: string;
    jti: string;
    client_id?: string;
    scope?: string;
    nbf?: number;
    nonce?: string;
};

export interface ResolveIssuanceSessionOptions {
    tenantId: string;
    tokenPayload: OAuth2TokenPayload;
    status?: SessionStatus;
    requiredCredentialConfigurationId?: string;
}

@Injectable()
export class TokenSessionResolverService {
    constructor(
        private readonly sessionService: SessionService,
        private readonly configService: ConfigService,
        private readonly authzService: AuthorizeService,
        private readonly authorizationServersService: AuthorizationServersService,
    ) {}

    private isExpired(session: Session): boolean {
        return !!session.expiresAt && session.expiresAt.getTime() <= Date.now();
    }

    private assertCredentialConfigurationInOffer(
        session: Session,
        credentialConfigurationId: string,
    ): void {
        const offeredIds =
            session.credentialPayload?.credentialConfigurationIds;
        if (
            !Array.isArray(offeredIds) ||
            !offeredIds.includes(credentialConfigurationId)
        ) {
            throw new CredentialRequestException(
                "invalid_credential_request",
                `Credential configuration '${credentialConfigurationId}' is not authorized for this issuance session`,
            );
        }
    }

    private async resolveExternalSession(
        options: ResolveIssuanceSessionOptions,
    ): Promise<Session> {
        const {
            tenantId,
            tokenPayload,
            status,
            requiredCredentialConfigurationId,
        } = options;

        const externalServerConfig =
            await this.authorizationServersService.getExternalAuthorizationServerConfigByIssuer(
                tenantId,
                tokenPayload.iss,
            );

        if (!externalServerConfig) {
            throw new CredentialRequestException(
                "credential_request_denied",
                `Token issuer '${tokenPayload.iss}' is not a configured external authorization server`,
            );
        }

        const binding = externalServerConfig.sessionBinding;
        if (
            binding?.method !== "access_token_claim" ||
            typeof binding.claim !== "string" ||
            binding.claim.length === 0
        ) {
            throw new CredentialRequestException(
                "credential_request_denied",
                "External authorization server session binding is not configured",
            );
        }

        const issuerState = tokenPayload[binding.claim];
        if (
            typeof issuerState !== "string" ||
            issuerState.trim().length === 0
        ) {
            throw new CredentialRequestException(
                "credential_request_denied",
                `Access token is missing required external session-binding claim '${binding.claim}'`,
            );
        }

        const where: { id: string; tenantId: string; status?: SessionStatus } =
            {
                id: issuerState,
                tenantId,
            };
        if (status) {
            where.status = status;
        }

        const session = await this.sessionService.getBy(where).catch(() => {
            throw new CredentialRequestException(
                "credential_request_denied",
                "The issuance session is invalid or no longer active",
            );
        });

        if (!session.credentialPayload) {
            throw new CredentialRequestException(
                "credential_request_denied",
                "The issuance session does not contain a credential offer context",
            );
        }

        if (session.credentialPayload.flow !== FlowType.AUTH_CODE) {
            throw new CredentialRequestException(
                "credential_request_denied",
                "The issuance session is not an authorization code flow session",
            );
        }

        if (
            typeof session.authorizationServerIssuer !== "string" ||
            session.authorizationServerIssuer !== tokenPayload.iss
        ) {
            throw new CredentialRequestException(
                "credential_request_denied",
                "Access token issuer does not match the authorization server selected for this offer",
            );
        }

        if (requiredCredentialConfigurationId) {
            this.assertCredentialConfigurationInOffer(
                session,
                requiredCredentialConfigurationId,
            );
        }

        if (this.isExpired(session)) {
            throw new CredentialRequestException(
                "credential_request_denied",
                "The issuance session has expired",
            );
        }

        const bound = await this.sessionService.bindExternalIdentity(
            session.id,
            tenantId,
            tokenPayload.iss,
            tokenPayload.sub,
        );

        if (!bound) {
            throw new CredentialRequestException(
                "credential_request_denied",
                "The issuance session is already bound to a different authenticated subject",
            );
        }

        return bound;
    }

    async resolveIssuanceSession(
        options: ResolveIssuanceSessionOptions,
    ): Promise<{
        session: Session;
        tokenSource: "local" | "chained" | "external";
    }> {
        const { tenantId, tokenPayload, status } = options;

        const localIssuer = this.authzService.getAuthzIssuer(tenantId);
        const publicUrl = this.configService.getOrThrow<string>("PUBLIC_URL");
        const chainedAsIssuer = `${publicUrl}/issuers/${tenantId}/chained-as`;

        const hasChainedAuthorizationServer =
            await this.authorizationServersService.hasEnabledChainedAuthorizationServer(
                tenantId,
            );
        const managedAuthorizationServerIssuers = new Set(
            await this.authorizationServersService.getAuthorizationServerIssuerUrls(
                tenantId,
            ),
        );

        const isLocalAsToken = tokenPayload.iss === localIssuer;
        const isManagedToken =
            (hasChainedAuthorizationServer &&
                tokenPayload.iss === chainedAsIssuer) ||
            managedAuthorizationServerIssuers.has(tokenPayload.iss);

        const externalServerConfig =
            await this.authorizationServersService.getExternalAuthorizationServerConfigByIssuer(
                tenantId,
                tokenPayload.iss,
            );

        if (externalServerConfig) {
            const session = await this.resolveExternalSession(options);
            return { session, tokenSource: "external" };
        }

        if (isManagedToken) {
            const issuerState = tokenPayload.issuer_state;
            if (typeof issuerState !== "string" || issuerState.length === 0) {
                throw new CredentialRequestException(
                    "credential_request_denied",
                    "Managed authorization server token is missing issuer_state claim",
                );
            }

            const where: {
                id: string;
                tenantId: string;
                status?: SessionStatus;
            } = {
                id: issuerState,
                tenantId,
            };
            if (status) {
                where.status = status;
            }

            const session = await this.sessionService.getBy(where).catch(() => {
                throw new CredentialRequestException(
                    "credential_request_denied",
                    "The issuance session is invalid or no longer active",
                );
            });

            return { session, tokenSource: "chained" };
        }

        if (!isLocalAsToken) {
            throw new CredentialRequestException(
                "credential_request_denied",
                "Access token issuer is not supported for this issuance endpoint",
            );
        }

        const where: { id: string; tenantId: string; status?: SessionStatus } =
            {
                id: tokenPayload.sub,
                tenantId,
            };
        if (status) {
            where.status = status;
        }

        const session = await this.sessionService.getBy(where).catch(() => {
            throw new CredentialRequestException(
                "credential_request_denied",
                "The access token is not associated with a valid issuance session",
            );
        });

        if (session.id !== tokenPayload.sub) {
            throw new CredentialRequestException(
                "credential_request_denied",
                "The access token is not associated with a valid issuance session",
            );
        }

        return { session, tokenSource: "local" };
    }
}
