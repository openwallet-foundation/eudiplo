# Task: Migrate all EUDIPLO DTOs from class-validator to Zod

## Goal

Replace EUDIPLO’s `class-validator`/`class-transformer` DTO validation with Zod 4 so that one schema becomes the source of truth for:

* Runtime request validation
* TypeScript types
* NestJS/OpenAPI models
* JSON Schema Draft 2020-12 generation
* Monaco autocomplete and validation
* Discriminated unions

Complete the migration for all DTOs, not only the authorization-server example.

## Current state

Relevant locations include:

* `apps/backend/src/main.ts`
* `apps/backend/src/**/*.dto.ts`
* TypeORM entities currently also used as API models
* `scripts/generate-from-openapi.ts`
* `schemas/*.schema.json`
* `apps/client/src/app/utils/schemas.ts`
* `apps/client/src/app/utils/schemas.json`
* `apps/client/src/app/utils/editor/editor.component.ts`

The backend already depends on `nestjs-zod` and calls `cleanupOpenApiDoc()`, but still uses a global `ValidationPipe` and class-validator DTOs.

The existing OpenAPI-to-JSON-Schema pipeline copies OpenAPI-specific keywords such as `discriminator.mapping`, `nullable`, and singular `example` into schemas consumed by AJV. This causes errors such as:

```text
Error: discriminator: mapping is not supported
```

## Target architecture

Create a browser-safe shared package, following existing monorepo naming conventions, that contains the reusable Zod schemas. A suitable name would be:

```text
packages/eudiplo-schemas
```

The package must not depend on NestJS, TypeORM, or backend services.

It should export:

* Individual Zod schemas
* Inferred TypeScript types
* A registry of schemas that must be exposed to Monaco
* Stable schema names/IDs
* Helpers needed to generate JSON Schema Draft 2020-12

Backend NestJS DTO classes should be thin wrappers:

```ts
export class IssuanceConfigDto extends createZodDto(
  IssuanceConfigSchema,
) {}
```

The backend and client must import the same underlying Zod schemas.

## Scope

Migrate:

* All request body DTOs
* Query and parameter DTOs
* Response DTOs currently represented in OpenAPI
* Nested DTOs
* Configuration models
* Discriminated unions
* DTOs created through `PartialType`, `PickType`, `OmitType`, or inheritance
* Validation classes currently embedded in TypeORM entities

Do not convert TypeORM entities themselves into Zod DTOs. Where an entity is currently used directly as an API input or response, introduce a separate Zod-backed DTO and map between it and the persistence entity.

Inventory the scope first with searches such as:

```bash
rg "class-validator|class-transformer|ValidateNested|ApiProperty|PartialType|PickType|OmitType" apps/backend/src
rg "@Body|@Query|@Param|@ApiResponse|@ApiOkResponse" apps/backend/src
```

Maintain a migration checklist and continue until every DTO is accounted for.

## Validation mapping

Preserve current runtime behavior unless an intentional change is documented and tested.

Pay particular attention to:

| Existing behavior     | Zod equivalent                                                               |
| --------------------- | ---------------------------------------------------------------------------- |
| `@IsString()`         | `z.string()`                                                                 |
| `@IsBoolean()`        | `z.boolean()`                                                                |
| `@IsNumber()`         | `z.number()`                                                                 |
| `@IsInt()`            | `z.int()`                                                                    |
| `@IsIn(["x"])`        | `z.literal("x")`                                                             |
| `@IsIn([...])` / enum | `z.enum(...)`                                                                |
| `@IsArray()`          | `z.array(...)`                                                               |
| `@ArrayMinSize(n)`    | `.min(n)`                                                                    |
| `@ValidateNested()`   | Nested Zod schema                                                            |
| `@IsOptional()`       | Check existing null behavior; use `.optional()` or `.nullish()` deliberately |
| `PartialType`         | `.partial()`                                                                 |
| `PickType`            | `.pick()`                                                                    |
| `OmitType`            | `.omit()`                                                                    |
| `@ValidateIf()`       | Prefer a union/discriminated union; otherwise `.superRefine()`               |
| Custom validators     | `.refine()` or `.superRefine()`                                              |

Do not enable coercion unless the existing endpoint already transforms that value.

For editable configuration files, prefer `z.strictObject()` so backend validation and Monaco both reject unknown properties. For other API inputs, preserve the current `whitelist: true` behavior intentionally.

Environment placeholders such as `${VAULT_URL}` must remain valid where they are currently accepted; do not replace plain string validation with URL validation in those cases.

## Discriminated unions

Replace manually synchronized TypeScript unions, `@Type({ discriminator })`, class-validator decorators, and OpenAPI discriminator mappings with native Zod discriminated unions.

Example:

```ts
const AuthorizationServerBaseSchema = z.strictObject({
  id: z.string(),
  label: z.string().optional(),
  enabled: z.boolean().optional(),
});

const ExternalAuthorizationServerSchema =
  AuthorizationServerBaseSchema.extend({
    type: z.literal("external"),
    issuer: z.url(),
  });

const Oid4VpAuthorizationServerSchema =
  AuthorizationServerBaseSchema.extend({
    type: z.literal("oid4vp"),
    presentationConfigId: z.string(),
  });

export const AuthorizationServerSchema = z.discriminatedUnion(
  "type",
  [
    ExternalAuthorizationServerSchema,
    Oid4VpAuthorizationServerSchema,
    ChainedAuthorizationServerSchema,
    BuiltInAuthorizationServerSchema,
  ],
);
```

Migrate at least these existing unions and search for further ones:

* Authorization-server types
* KMS provider types
* HTTP KMS authentication types
* Trust-list entities
* Trusted-authority query types
* DCQL credential formats
* Embedded disclosure policies
* Authentication method configurations

The existing `HttpKmsConfigDto.auth` OpenAPI schema only exposes the base authentication model. Ensure the migrated schema includes the bearer, OAuth2 client credentials, mTLS, and none variants with their relevant fields.

## NestJS integration

1. Add `zod` as an explicit workspace dependency rather than relying on a transitive dependency.
2. Use `createZodDto()` for controller-facing DTO classes.
3. Replace the global class-validator `ValidationPipe` with `ZodValidationPipe` once all controller inputs are migrated.
4. During the transition, use a hybrid dispatching pipe if necessary so class-validator and Zod DTOs are never both applied to the same input.
5. Preserve the current HTTP validation-error response format. Update `ValidationErrorFilter` or introduce handling for `ZodValidationException`.
6. Continue using `cleanupOpenApiDoc()` with OpenAPI 3.1.
7. Preserve component names, endpoint paths, operation contracts, descriptions, examples, and formats as far as possible.
8. Move Swagger field metadata into Zod `.meta()` declarations. Retain manual Swagger decorators only for endpoint-level information or cases that cannot be represented by the Zod schema.
9. Handle response DTOs carefully. Use codecs for values such as `Date` where runtime and serialized types differ. Do not enable global response validation until all affected responses pass.

## JSON Schema generation

Replace the OpenAPI-to-JSON-Schema conversion for Monaco with direct Zod generation:

```ts
z.toJSONSchema(schema, {
  target: "draft-2020-12",
});
```

Requirements:

* Generate `schemas/*.schema.json` from the shared Zod registry.
* Generate `apps/client/src/app/utils/schemas.json`.
* Preserve stable filenames and `$id` values where possible.
* Generate standard `oneOf` plus `const` schemas for discriminated unions.
* Do not emit OpenAPI `discriminator`, `discriminator.mapping`, or `nullable`.
* Use standard `examples`, not singular OpenAPI `example`.
* Do not manually edit generated schemas.
* Remove `@openapi-contrib/openapi-schema-to-json-schema` and `$RefParser` if no longer used elsewhere.
* Keep OpenAPI generation for documentation and SDK generation separate from Monaco JSON Schema generation.
* Ensure schema generation is deterministic and produces no diff when run twice.

Add an AJV 2020-12 generation test that registers and compiles every emitted schema in strict mode. Calling `addSchema()` is insufficient; force compilation with `getSchema()`.

## Client and Monaco integration

Prefer using the shared Zod schema for actual editor value validation:

```ts
const result = selectedSchema.safeParse(parsedValue);
```

Continue supplying generated JSON Schema to Monaco for:

* Autocomplete
* Hover documentation
* Required-property hints
* Enum/constant suggestions
* Schema diagnostics

Remove AJV from the client if it has no remaining use after Zod validation is introduced. AJV may remain as a development-time JSON Schema compatibility test.

Update `SchemaValidation` so it can associate:

* The Zod runtime schema
* The generated JSON Schema ID
* The Monaco file-match URI

Ensure setting a discriminator such as:

```json
{ "type": "external" }
```

causes Monaco to suggest only the relevant branch fields, such as `issuer`.

If Monaco cannot reliably suggest every discriminator value before `type` is selected, add `defaultSnippets` for the variants rather than reintroducing OpenAPI discriminator mappings.

## Migration sequence

1. Inventory all DTOs, controller inputs, responses, nested models, and entity/API overlaps.
2. Capture the current OpenAPI document and relevant validation behavior as a baseline.
3. Introduce the shared Zod schemas package and generation infrastructure.
4. Migrate representative complex contracts first:

   * Authorization servers
   * KMS providers and nested HTTP authentication
5. Verify NestJS OpenAPI, JSON Schema generation, Monaco, and runtime validation.
6. Migrate the remaining modules one by one while keeping builds and tests green.
7. Separate TypeORM entities from API DTOs wherever they are currently combined.
8. Switch the global validation infrastructure to Zod.
9. Replace client AJV validation with shared Zod validation.
10. Remove obsolete decorators, imports, dependencies, converter code, and generated artifacts.
11. Regenerate OpenAPI, JSON Schemas, and the SDK.
12. Run the full test and build suite.

Do not stop after the representative migration; complete the full DTO inventory.

## Required tests

Add focused tests for:

* Every discriminated union accepting all valid variants
* Unknown discriminator values being rejected
* A discriminator variant missing its required fields
* Fields from the wrong discriminator branch being rejected for strict config objects
* Optional versus nullable behavior
* Unknown-property handling
* Defaults
* Nested arrays and objects
* Date/time serialization
* Custom and cross-field validation
* HTTP KMS authentication variants
* JSON Schema compilation with strict AJV 2020-12
* OpenAPI generation
* Monaco schema association and branch-specific completion, preferably through a client test or Playwright

Run at least:

```bash
pnpm lint
pnpm test
pnpm build
pnpm run gen:api
pnpm run gen:sdk
```

Also run the repository’s relevant backend e2e, client, and Playwright tests.

## Acceptance criteria

* No controller request DTO relies on class-validator.
* All DTOs from the migration inventory are resolved.
* TypeORM entities are no longer used directly as request DTOs.
* The backend validates controller inputs with Zod.
* Existing validation error responses remain compatible or changes are explicitly documented.
* OpenAPI 3.1 generation succeeds.
* The generated SDK builds.
* JSON Schemas are generated directly from Zod.
* Every emitted JSON Schema compiles with strict AJV 2020-12.
* Monaco receives no `discriminator.mapping`.
* Authorization-server and KMS discriminated unions provide branch-specific Monaco fields.
* Existing backend, client, e2e, and protocol tests pass.
* Generated artifacts are deterministic.
* `class-validator` is removed from dependencies if no legitimate usages remain.
* `class-transformer` is removed only if it has no remaining non-DTO use.
* The final report lists any intentional API or validation behavior changes.

## Final report

When finished, provide:

1. A summary of the new architecture.
2. The number of DTOs and modules migrated.
3. Any TypeORM entities separated from API DTOs.
4. Dependencies added and removed.
5. Validation behavior changes.
6. OpenAPI or SDK compatibility changes.
7. Commands and tests run with their results.
8. Any remaining blockers or follow-up work.
