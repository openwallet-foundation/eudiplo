import { resolve } from "node:path";
import Joi from "joi";
import { buildModelFromSchema } from "./config-docs/model";
import {
    renderGroupPage,    
    slugify,
    writeFileSafely,
} from "./config-docs/render";
import { VALIDATION_SCHEMA } from "../apps/backend/src/platform/config/combined.schema";

async function main() {
    const model = buildModelFromSchema(VALIDATION_SCHEMA as Joi.ObjectSchema);

    // Write per-group pages
    const groupFiles: { file: string; title: string }[] = [];
    for (const g of model.groups) {
        const slug = slugify(g.name);
        const rel = `generated/config-${slug}.md`;
        const abs = resolve("docs", rel);
        await writeFileSafely(abs, renderGroupPage(g));
        groupFiles.push({ file: rel, title: g.name });
    }            

    // Optionally, also emit a JSON artifact for tooling
    // const jsonAbs = resolve("docs", "generated", "config-all.json");
    // await writeFileSafely(jsonAbs, JSON.stringify(model, null, 2));

    console.log(
        `Generated ${groupFiles.length} group pages and config/index.md`,
    );
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
