import { NoSuchKey, NotFound } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";
import { verifyS3Access } from "./storage.module.js";

/**
 * Regression test: startup must fail fast on real auth/permission problems,
 * but NOT on a minimally-scoped bucket policy (object-level permissions
 * only, no s3:ListBucket/s3:HeadBucket) \u2014 the probe object simply not
 * existing (NotFound/NoSuchKey) must count as a successful check.
 */
describe("verifyS3Access", () => {
    const bucket = "my-bucket";

    function fakeClient(sendImpl: () => Promise<unknown>) {
        return {
            send: vi.fn(sendImpl),
        } as unknown as import("@aws-sdk/client-s3").S3Client;
    }

    it("resolves when the probe object does not exist (NotFound)", async () => {
        const err = new NotFound({ message: "not found", $metadata: {} });
        const s3 = fakeClient(() => Promise.reject(err));

        await expect(verifyS3Access(s3, bucket)).resolves.toBeUndefined();
    });

    it("resolves when the probe object does not exist (NoSuchKey)", async () => {
        const err = new NoSuchKey({ message: "no such key", $metadata: {} });
        const s3 = fakeClient(() => Promise.reject(err));

        await expect(verifyS3Access(s3, bucket)).resolves.toBeUndefined();
    });

    it("resolves when the head request succeeds", async () => {
        const s3 = fakeClient(() => Promise.resolve({}));

        await expect(verifyS3Access(s3, bucket)).resolves.toBeUndefined();
    });

    it("throws a clear error on access-denied / bad credentials", async () => {
        const err = Object.assign(new Error("Access Denied"), {
            name: "AccessDenied",
        });
        const s3 = fakeClient(() => Promise.reject(err));

        await expect(verifyS3Access(s3, bucket)).rejects.toThrow(
            /Unable to authenticate to S3 bucket "my-bucket"/,
        );
    });

    it("throws when credentials cannot be resolved at all", async () => {
        const err = new Error("Could not load credentials from any providers");
        const s3 = fakeClient(() => Promise.reject(err));

        await expect(verifyS3Access(s3, bucket)).rejects.toThrow(
            /Could not load credentials from any providers/,
        );
    });
});
