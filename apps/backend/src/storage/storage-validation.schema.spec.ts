import { describe, expect, it } from "vitest";
import { STORAGE_VALIDATION_SCHEMA } from "./storage-validation.schema.js";

/**
 * Regression test: S3 credentials must be optional so deployments using
 * IRSA (EKS) or an EC2/ECS instance profile can start without static keys,
 * letting the AWS SDK's default credential provider chain resolve them.
 */
describe("STORAGE_VALIDATION_SCHEMA", () => {
    it("passes when STORAGE_DRIVER=s3 with no static credentials (IRSA/instance-profile)", () => {
        const result = STORAGE_VALIDATION_SCHEMA.validate(
            {
                STORAGE_DRIVER: "s3",
                S3_REGION: "eu-west-1",
                S3_BUCKET: "my-bucket",
                FOLDER: "/tmp",
            },
            { allowUnknown: true },
        );

        expect(result.error).toBeUndefined();
    });

    it("still passes when static S3 credentials are provided", () => {
        const result = STORAGE_VALIDATION_SCHEMA.validate(
            {
                STORAGE_DRIVER: "s3",
                S3_REGION: "eu-west-1",
                S3_BUCKET: "my-bucket",
                S3_ACCESS_KEY_ID: "AKIA...",
                S3_SECRET_ACCESS_KEY: "secret",
                FOLDER: "/tmp",
            },
            { allowUnknown: true },
        );

        expect(result.error).toBeUndefined();
    });

    it("still requires S3_REGION and S3_BUCKET when STORAGE_DRIVER=s3", () => {
        const result = STORAGE_VALIDATION_SCHEMA.validate(
            { STORAGE_DRIVER: "s3", FOLDER: "/tmp" },
            { allowUnknown: true, abortEarly: false },
        );

        expect(result.error?.message).toContain("S3_REGION");
        expect(result.error?.message).toContain("S3_BUCKET");
    });
});
