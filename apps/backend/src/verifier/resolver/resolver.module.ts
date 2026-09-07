import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { ResolverService } from "./resolver.service.js";

@Module({
    imports: [HttpModule],
    providers: [ResolverService],
    exports: [ResolverService],
})
export class ResolverModule {}
