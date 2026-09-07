import { S3Client } from "@aws-sdk/client-s3";
import { DynamicModule, Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LocalFileStorage } from "./adapters/local.storage.js";
import { S3FileStorage } from "./adapters/s3.storage.js";
import { FileEntity } from "./entities/files.entity.js";
import { FilesService } from "./files.service.js";
import { StorageController } from "./storage.controller.js";
import { FILE_STORAGE, FileStorage } from "./storage.types.js";

type Driver = "local" | "s3";

@Global()
@Module({})
export class StorageModule {
    static forRoot(): DynamicModule {
        return {
            module: StorageModule,
            imports: [TypeOrmModule.forFeature([FileEntity])],
            controllers: [StorageController],
            providers: [
                FilesService,
                {
                    provide: FILE_STORAGE,
                    inject: [ConfigService],
                    useFactory: (cfg: ConfigService): FileStorage => {
                        const driver = cfg.get<Driver>("STORAGE_DRIVER");
                        if (driver === "s3") {
                            return new S3FileStorage(
                                new S3Client({
                                    region: cfg.get<string>("S3_REGION"),
                                    endpoint: cfg.get<string>("S3_ENDPOINT"),
                                    forcePathStyle: cfg.get<boolean>(
                                        "S3_FORCE_PATH_STYLE",
                                    ),
                                    credentials: {
                                        accessKeyId:
                                            cfg.get<string>(
                                                "S3_ACCESS_KEY_ID",
                                            )!,
                                        secretAccessKey: cfg.get<string>(
                                            "S3_SECRET_ACCESS_KEY",
                                        )!,
                                    },
                                }),
                                cfg.get<string>("S3_BUCKET")!,
                            );
                        }
                        // local
                        return new LocalFileStorage(
                            cfg.getOrThrow<string>("LOCAL_STORAGE_DIR"),
                        );
                    },
                },
            ],
            exports: [FilesService],
        };
    }
}
