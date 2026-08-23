export interface ImportOptions<T extends object> {
    /** Explicit portable resource kind. Inferred from resourceType when omitted. */
    resourceKind?: import("../config-portability/config-resource.types").ConfigResourceKind;

    /**
     * Subfolder within each tenant directory (e.g., "issuance", "keys", "images")
     */
    subfolder: string;

    /**
     * File extension filter (e.g., ".json", ".png"). If not provided, all files are processed.
     */
    fileExtension?: string;

    /**
     * Zod schema or Zod DTO class used to validate imported payloads.
     */
    validationSchema?: unknown;

    /**
     * Backward-compatible alias for validationSchema.
     * @deprecated Use validationSchema.
     */
    validationClass?: unknown;

    /**
     * Check if item already exists
     */
    checkExists: (tenantId: string, data: T, file: string) => Promise<boolean>;

    /**
     * Delete existing item if force is enabled
     */
    deleteExisting?: (tenantId: string, data: T, file: string) => Promise<void>;

    /**
     * Process and store the item
     */
    processItem: (tenantId: string, data: T, file: string) => Promise<void>;

    /**
     * Custom data loader (e.g., for JSON files vs binary files)
     */
    loadData?: (filePath: string) => T | Promise<T>;

    /**
     * Custom validation error formatter
     */
    formatValidationError?: (error: unknown) => any;

    /**
     * Resource type name for logging (e.g., "credential config", "key", "image")
     */
    resourceType: string;
}

/**
 * Import options for tenant-specific imports (without tenantId parameter in callbacks).
 * Used with importConfigsForTenant where tenantId is passed separately.
 */
export type TenantImportOptions<T extends object> = ImportOptions<T>;
