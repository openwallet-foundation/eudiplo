import { createZodDto } from "nestjs-zod";
import { z } from "zod";

const DisplayLogoSchema = z
    .object({
        uri: z.string(),
        alt_text: z.string().optional(),
    })
    .catchall(z.unknown());

class DisplayLogo extends createZodDto(DisplayLogoSchema) {
    uri!: string;

    alt_text?: string;
}

const DisplayInfoSchema = z
    .object({
        name: z.string().optional(),
        locale: z.string().optional(),
        logo: DisplayLogoSchema.optional(),
    })
    .catchall(z.unknown());

export class DisplayInfo extends createZodDto(DisplayInfoSchema) {
    name?: string;

    locale?: string;

    logo?: DisplayLogo;
}
