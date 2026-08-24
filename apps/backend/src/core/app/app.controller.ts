import { Controller, Get, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
    ApiOperation,
    ApiResponse,
    ApiSecurity,
    ApiTags,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/auth.guard";
import { ConfigImportModeService } from "../../platform/config-import/config-import-mode.service";
import { FrontendConfigResponseDto } from "./dto/frontend-config-response.dto";
import { VersionResponseDto } from "./dto/version-response.dto";

/**
 * Main application controller
 */
@ApiTags("App")
@Controller()
export class AppController {
    constructor(
        private readonly configService: ConfigService,
        private readonly configImportModeService: ConfigImportModeService,
    ) {}

    /**
     * Main endpoint providing service info
     */
    @Get()
    main() {
        return {
            service: "EUDIPLO",
            documentation:
                "https://openwallet-foundation.github.io/eudiplo/docs/latest/",
        };
    }

    /**
     * Returns the running service version. Requires authentication.
     */
    @Get("version")
    @UseGuards(JwtAuthGuard)
    @ApiSecurity("oauth2")
    @ApiOperation({ summary: "Get service version" })
    @ApiResponse({
        status: 200,
        description: "Service version info",
        type: VersionResponseDto,
    })
    getVersion(): VersionResponseDto {
        return {
            version: process.env.VERSION ?? "main",
        };
    }

    /**
     * Returns runtime configuration for the frontend client.
     */
    @Get("frontend-config")
    @UseGuards(JwtAuthGuard)
    @ApiSecurity("oauth2")
    @ApiOperation({ summary: "Get frontend runtime configuration" })
    @ApiResponse({
        status: 200,
        description: "Frontend configuration",
        type: FrontendConfigResponseDto,
    })
    getFrontendConfig(): FrontendConfigResponseDto {
        const grafanaUrl = this.configService.get<string>("GRAFANA_URL");
        return {
            grafana: {
                url: grafanaUrl || undefined,
                tempoUid: this.configService.get<string>(
                    "GRAFANA_DATASOURCE_TEMPO_UID",
                    "tempo",
                ),
                lokiUid: this.configService.get<string>(
                    "GRAFANA_DATASOURCE_LOKI_UID",
                    "loki",
                ),
            },
            configImportMode: this.configImportModeService.resolve(),
        };
    }
}
