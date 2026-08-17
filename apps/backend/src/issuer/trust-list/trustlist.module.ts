import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TenantEntity } from "../../auth/tenant/entities/tenant.entity";
import { TrustList } from "./entities/trust-list.entity";
import { TrustListVersion } from "./entities/trust-list-version.entity";
import { TrustListPublicController } from "./trust-list-public/trust-list-public.controller";
import { TrustListController } from "./trustlist.controller";
import { TrustListService } from "./trustlist.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([TrustList, TrustListVersion, TenantEntity]),
    ],
    providers: [TrustListService],
    controllers: [TrustListController, TrustListPublicController],
    exports: [TrustListService],
})
export class TrustListModule {}
