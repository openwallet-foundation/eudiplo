import { beforeEach, describe, expect, it, vi } from "vitest";
import { SdjwtvcverifierService } from "./sdjwtvcverifier.service";

const instanceConfigs: any[] = [];
const verifyMock = vi.fn();

vi.mock("@sd-jwt/sd-jwt-vc", () => ({
    SDJwtVcInstance: class {
        private readonly cfg: any;

        constructor(cfg: any) {
            this.cfg = cfg;
            instanceConfigs.push(cfg);
        }

        verify(cred: string, options: any) {
            return verifyMock(cred, options, this.cfg);
        }
    },
}));

describe("SdjwtvcverifierService revocation mode", () => {
    let service: SdjwtvcverifierService;
    const logger = {
        setContext: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
    };

    beforeEach(() => {
        verifyMock.mockReset();
        instanceConfigs.length = 0;
        vi.clearAllMocks();

        const resolverService = {};
        const cryptoService = {};
        const chainValidation = {
            fetchStatusListJwt: vi.fn(),
        };

        service = new SdjwtvcverifierService(
            resolverService as any,
            cryptoService as any,
            chainValidation as any,
            logger as any,
        );
    });

    it("retries without status check in best-effort mode when status list is unavailable", async () => {
        verifyMock.mockImplementation(
            async (_cred: string, _options: any, cfg: any) => {
                if (cfg.statusListFetcher) {
                    throw new Error(
                        "Status list fetch timed out after 10000ms",
                    );
                }
                return {
                    payload: { sub: "abc" },
                };
            },
        );

        const result = await service.verify("credential", {
            policy: {
                requireX5c: true,
                revocation: {
                    enabled: true,
                    failClosed: false,
                },
            },
        } as any);

        expect(result.payload).toEqual({ sub: "abc" });
        expect(verifyMock).toHaveBeenCalledTimes(2);
        expect(instanceConfigs[0].statusListFetcher).toBeTypeOf("function");
        expect(instanceConfigs[1].statusListFetcher).toBeUndefined();
        expect(logger.warn).toHaveBeenCalledOnce();
    });

    it("fails closed in strict mode when status list is unavailable", async () => {
        verifyMock.mockImplementation(async () => {
            throw new Error("Status list unavailable");
        });

        await expect(
            service.verify("credential", {
                policy: {
                    requireX5c: true,
                    revocation: {
                        enabled: true,
                        failClosed: true,
                    },
                },
            } as any),
        ).rejects.toThrow("Status list unavailable");

        expect(verifyMock).toHaveBeenCalledTimes(1);
        expect(instanceConfigs[0].statusListFetcher).toBeTypeOf("function");
        expect(logger.warn).not.toHaveBeenCalled();
    });

    it("skips status callbacks entirely when revocation is disabled", async () => {
        verifyMock.mockResolvedValue({ payload: { ok: true } });

        const result = await service.verify("credential", {
            policy: {
                requireX5c: true,
                revocation: {
                    enabled: false,
                    failClosed: false,
                },
            },
        } as any);

        expect(result.payload).toEqual({ ok: true });
        expect(verifyMock).toHaveBeenCalledTimes(1);
        expect(instanceConfigs[0].statusListFetcher).toBeUndefined();
        expect(instanceConfigs[0].statusVerifier).toBeUndefined();
    });
});
