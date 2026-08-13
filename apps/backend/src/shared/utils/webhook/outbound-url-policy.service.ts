import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

@Injectable()
export class OutboundUrlPolicyService {
    constructor(private readonly configService: ConfigService) {}

    async assertSafeUrl(url: string): Promise<void> {
        let parsed: URL;
        try {
            parsed = new URL(url);
        } catch {
            throw new BadRequestException("Invalid outbound URL");
        }

        const protocol = parsed.protocol.toLowerCase();
        if (
            protocol !== "https:" &&
            !(protocol === "http:" && this.allowHttp())
        ) {
            throw new BadRequestException(
                "Outbound URL must use HTTPS in this environment",
            );
        }

        const hostname = parsed.hostname.toLowerCase();
        const allowlistedHosts = this.allowedHosts();
        if (
            allowlistedHosts.length > 0 &&
            !allowlistedHosts.some(
                (entry) => hostname === entry || hostname.endsWith(`.${entry}`),
            )
        ) {
            throw new BadRequestException(
                "Outbound URL host is not in the allowlist",
            );
        }

        if (this.allowPrivateNetwork()) {
            return;
        }

        if (this.isReservedHost(hostname)) {
            throw new BadRequestException(
                "Outbound URL host is not allowed in this environment",
            );
        }

        const directIpVersion = isIP(hostname);
        if (directIpVersion > 0) {
            if (this.isPrivateIp(hostname)) {
                throw new BadRequestException(
                    "Outbound URL target resolves to a private or loopback IP",
                );
            }
            return;
        }

        let resolved;
        try {
            resolved = await lookup(hostname, { all: true, verbatim: true });
        } catch {
            throw new BadRequestException(
                "Outbound URL host cannot be resolved",
            );
        }

        if (resolved.length === 0) {
            throw new BadRequestException(
                "Outbound URL host cannot be resolved",
            );
        }

        if (resolved.some((entry) => this.isPrivateIp(entry.address))) {
            throw new BadRequestException(
                "Outbound URL target resolves to a private or loopback IP",
            );
        }
    }

    private allowHttp(): boolean {
        return this.readBoolean(
            "OUTBOUND_URL_ALLOW_HTTP",
            process.env.NODE_ENV !== "production",
        );
    }

    private allowPrivateNetwork(): boolean {
        return this.readBoolean(
            "OUTBOUND_URL_ALLOW_PRIVATE_NETWORK",
            process.env.NODE_ENV !== "production",
        );
    }

    private readBoolean(key: string, fallback: boolean): boolean {
        const configured = this.configService.get<string | boolean>(key, fallback);
        if (configured === undefined || configured === null) {
            return fallback;
        }
        if (typeof configured === "boolean") {
            return configured;
        }
        return configured.toLowerCase() === "true";
    }

    private allowedHosts(): string[] {
        const raw = this.configService.get<string>(
            "OUTBOUND_URL_ALLOWED_HOSTS",
            "",
        );
        if (!raw) return [];
        return raw
            .split(",")
            .map((value) => value.trim().toLowerCase())
            .filter((value) => value.length > 0);
    }

    private isReservedHost(hostname: string): boolean {
        return hostname === "localhost" || hostname.endsWith(".localhost");
    }

    private isPrivateIp(address: string): boolean {
        const normalized = address.toLowerCase();

        if (normalized.startsWith("::ffff:")) {
            return this.isPrivateIp(normalized.slice("::ffff:".length));
        }

        const version = isIP(normalized);
        if (version === 4) {
            const octets = normalized
                .split(".")
                .map((v) => Number.parseInt(v, 10));
            const [a, b] = octets;
            if (a === 10) return true;
            if (a === 127) return true;
            if (a === 169 && b === 254) return true;
            if (a === 172 && b >= 16 && b <= 31) return true;
            if (a === 192 && b === 168) return true;
            if (a === 0) return true;
            return false;
        }

        if (version === 6) {
            if (normalized === "::1" || normalized === "::") return true;
            if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
                return true;
            }
            if (/^fe[89ab]/i.test(normalized)) return true;
            return false;
        }

        return true;
    }
}
