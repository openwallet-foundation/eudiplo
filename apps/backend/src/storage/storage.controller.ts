import {
    Controller,
    Get,
    NotFoundException,
    Param,
    Post,
    StreamableFile,
    UploadedFile,
    UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Role } from "../auth/roles/role.enum";
import { Secured } from "../auth/secure.decorator";
import { Token, TokenPayload } from "../auth/token.decorator";
import { FileUploadDto } from "./dto/file-upload.dto";
import { StoredObjectResponseDto } from "./dto/stored-object-response.dto";
import { FilesService } from "./files.service";

/**
 * Storage Controller
 */
@ApiTags("Storage")
@Controller("storage")
export class StorageController {
    /**
     * Constructor
     * @param filesService The files service
     */
    constructor(private readonly filesService: FilesService) {}

    /**
     * Upload files that belong to a tenant like images
     * @param user
     * @param file
     * @returns
     */
    @UseInterceptors(FileInterceptor("file"))
    @Secured([Role.Issuances])
    @ApiConsumes("multipart/form-data")
    @ApiBody({
        type: FileUploadDto,
    })
    @ApiResponse({ status: 200, type: StoredObjectResponseDto })
    @Post()
    upload(
        @Token() user: TokenPayload,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.filesService.saveUserUpload(user.entity!.id, file, true);
    }

    /**
     * Get a file and stream it
     */
    @Get(":key")
    @ApiResponse({
        status: 200,
        description: "Binary file stream",
        content: {
            "application/octet-stream": {
                schema: { type: "string", format: "binary" },
            },
        },
    })
    download(@Param("key") key: string) {
        return this.filesService
            .getStream(key)
            .then(
                (stream) =>
                    new StreamableFile(stream.stream, {
                        //TODO: check if it should be attachment or not
                        disposition: "attachment",
                        type: stream.contentType,
                        length: stream.size,
                    }),
            )
            .catch(() => {
                throw new NotFoundException();
            });
    }
}
