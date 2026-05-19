import { readFileSync } from "node:fs";
import { ClassConstructor, plainToInstance } from "class-transformer";

export function loadJsonFile<T>(filePath: string): T {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

export function loadConfigDto<T extends object>(
    filePath: string,
    validationClass: ClassConstructor<T>,
): T {
    return plainToInstance(validationClass, loadJsonFile<object>(filePath));
}
