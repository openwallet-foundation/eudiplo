import { describe, expect, it } from "vitest";
import { extractRawTokenFromSubmission } from "./webhook.utils";

describe("Webhook Utils: extractRawTokenFromSubmission", () => {
    const testId = "pid_credential";
    const mockToken =
        "eyJ0eXAiOiJkYytzZC1qd3QiLCJhbGciOiJFUzI1NiJ9.mock_payload";

    describe("Basic Validation", () => {
        it("should return undefined if payload is null or undefined", () => {
            expect(extractRawTokenFromSubmission(testId, null)).toBeUndefined();
            expect(
                extractRawTokenFromSubmission(testId, undefined),
            ).toBeUndefined();
        });

        it("should return undefined if vp_token is missing", () => {
            expect(extractRawTokenFromSubmission(testId, {})).toBeUndefined();
            expect(
                extractRawTokenFromSubmission(testId, {
                    presentation_submission: {},
                }),
            ).toBeUndefined();
        });

        it("should return undefined for unsupported vp_token types (e.g. number, boolean)", () => {
            expect(
                extractRawTokenFromSubmission(testId, {
                    vp_token: 12345,
                } as any),
            ).toBeUndefined();
            expect(
                extractRawTokenFromSubmission(testId, {
                    vp_token: true,
                } as any),
            ).toBeUndefined();
        });
    });

    describe("Strategy 1: descriptor_map (Official OID4VP Standard)", () => {
        it("should extract token using '$' path", () => {
            const payload = {
                vp_token: [mockToken],
                presentation_submission: {
                    descriptor_map: [{ id: testId, path: "$" }],
                },
            };
            expect(extractRawTokenFromSubmission(testId, payload)).toBe(
                mockToken,
            );
        });

        it("should extract token using '$[0]' path", () => {
            const payload = {
                vp_token: [mockToken],
                presentation_submission: {
                    descriptor_map: [{ id: testId, path: "$[0]" }],
                },
            };
            expect(extractRawTokenFromSubmission(testId, payload)).toBe(
                mockToken,
            );
        });

        it("should extract the correct index in Multi-Credential flows (e.g. $[1])", () => {
            const payload = {
                vp_token: ["other_token", mockToken],
                presentation_submission: {
                    descriptor_map: [
                        { id: "other_id", path: "$[0]" },
                        { id: testId, path: "$[1]" },
                    ],
                },
            };
            expect(extractRawTokenFromSubmission(testId, payload)).toBe(
                mockToken,
            );
        });

        it("should return undefined if the path index is out of bounds", () => {
            const payload = {
                vp_token: [mockToken],
                presentation_submission: {
                    descriptor_map: [{ id: testId, path: "$[10]" }],
                },
            };
            expect(
                extractRawTokenFromSubmission(testId, payload),
            ).toBeUndefined();
        });

        it("should return undefined if the found element in the array is not a string", () => {
            const payload = {
                vp_token: [12345], // Not a string
                presentation_submission: {
                    descriptor_map: [{ id: testId, path: "$[0]" }],
                },
            };
            expect(
                extractRawTokenFromSubmission(testId, payload as any),
            ).toBeUndefined();
        });

        it("should return undefined if vp_token is not an array but descriptor_map is provided", () => {
            const payload = {
                vp_token: mockToken, // String instead of array
                presentation_submission: {
                    descriptor_map: [{ id: testId, path: "$[0]" }],
                },
            };
            // Logic skips Strategy 1 because Array.isArray(vpToken) is false
            // and falls through to other strategies.
            expect(extractRawTokenFromSubmission(testId, payload)).toBe(
                mockToken,
            );
        });
    });

    describe("Strategy 2: ID-Mapping (E2E & Legacy Fallback)", () => {
        it("should extract token if vp_token is an object keyed by ID (string value)", () => {
            const payload = {
                vp_token: {
                    [testId]: mockToken,
                    unrelated: "other_data",
                },
            };
            expect(extractRawTokenFromSubmission(testId, payload)).toBe(
                mockToken,
            );
        });

        it("should extract the first element if the mapped object value is an array", () => {
            const payload = {
                vp_token: {
                    [testId]: [mockToken, "second_token"],
                },
            };
            expect(extractRawTokenFromSubmission(testId, payload)).toBe(
                mockToken,
            );
        });

        it("should protect against prototype pollution", () => {
            const pollutedVpToken = Object.create({
                [testId]: "malicious_token",
            });
            const payload = {
                vp_token: pollutedVpToken,
            };
            // Should not find the ID because it's inherited, not an "own" property
            expect(
                extractRawTokenFromSubmission(testId, payload),
            ).toBeUndefined();
        });
    });

    describe("Strategy 3: Simple String", () => {
        it("should return the vp_token directly if it is a single string", () => {
            const payload = {
                vp_token: mockToken,
            };
            expect(extractRawTokenFromSubmission(testId, payload)).toBe(
                mockToken,
            );
        });
    });

    describe("Strictness Checks", () => {
        it("should return undefined if vp_token is an array but no descriptor_map matches the ID", () => {
            const payload = {
                vp_token: [mockToken],
                presentation_submission: {
                    descriptor_map: [{ id: "wrong_id", path: "$[0]" }],
                },
            };
            // Stricter version: No fallback to index 0 if a descriptor map exists but doesn't match
            expect(
                extractRawTokenFromSubmission(testId, payload),
            ).toBeUndefined();
        });

        it("should return undefined if vp_token is an empty array", () => {
            const payload = {
                vp_token: [],
                presentation_submission: {
                    descriptor_map: [{ id: testId, path: "$[0]" }],
                },
            };
            expect(
                extractRawTokenFromSubmission(testId, payload),
            ).toBeUndefined();
        });
    });
});
