// ajv's CommonJS package has no "exports" map, so TypeScript's NodeNext ESM
// resolver cannot see its dist/2020 subpath declaration file even though Node
// resolves it fine at runtime. This ambient shim restores type information.
declare module "ajv/dist/2020" {
    import Ajv, { AnySchemaObject, Options } from "ajv";

    export default class Ajv2020 extends Ajv {
        constructor(options?: Options);
        compile<T = unknown>(schema: AnySchemaObject): import("ajv").ValidateFunction<T>;
    }
}
