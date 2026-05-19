import * as axios from "axios";
import { mkdirSync, readFileSync } from "fs";
import https from "https";
import unzipper from "unzipper";

import { OIDF_HTTPD_CA_PATH } from "./oidf-setup";

export interface TestInstance {
    id: string;
    url: string;
}

export type OIDFProtocol = "oid4vci" | "oid4vp";
export type OIDFRole = "issuer" | "verifier" | "wallet";

export interface OIDFAvailablePlan {
    planName: string;
    profileNames: string[];
    protocols: OIDFProtocol[];
    roles: OIDFRole[];
    isHaip: boolean;
}

export interface OIDFPlanModule {
    testModule: string;
    variant: Record<string, string>;
}

interface TestResult {
    status: string;
    result: string;
}

export class OIDFSuite {
    instance: axios.AxiosInstance;
    constructor(OIDF_URL: string, OIDF_DEMO_TOKEN?: string) {
        // --- Prepare demo OIDF instance ----------------------------------------
        this.instance = axios.default.create({
            baseURL: OIDF_URL,
            headers: {
                Authorization: OIDF_DEMO_TOKEN
                    ? `Bearer ${OIDF_DEMO_TOKEN}`
                    : undefined,
                "Content-Type": "application/json",
            },
        });
        // The OIDF httpd CA cert is extracted by setupOidfContainers() (which
        // runs in beforeAll), so it isn't on disk yet when this constructor
        // executes at module load time. Resolve the agent per-request via an
        // interceptor that lazily reads the cert. The CN is "localhost" with
        // no SAN, so we keep chain validation on (rejectUnauthorized: true,
        // implicit) but bypass the SAN-only hostname check.
        this.instance.interceptors.request.use((config) => {
            if (!config.httpsAgent) {
                config.httpsAgent = new https.Agent({
                    ca: readFileSync(OIDF_HTTPD_CA_PATH),
                    checkServerIdentity: () => undefined,
                });
            }
            return config;
        });
    }

    createPlan(planId: string, variant: object, body: any): Promise<string> {
        return this.instance
            .post("/api/plan", body, {
                params: { planName: planId, variant: JSON.stringify(variant) },
            })
            .then(
                (res) => res.data.id,
                (err) => {
                    console.error(
                        "Error creating plan:",
                        err.response?.data || err,
                    );
                    throw err;
                },
            );
    }

    deletePlan(PLAN_ID: string) {
        return this.instance.delete(`/api/plan/${PLAN_ID}`);
    }

    async storeLog(PLAN_ID: string, outputDir: string): Promise<void> {
        const response = await this.instance.get(
            `/api/plan/exporthtml/${PLAN_ID}`,
            {
                params: { public: false },
                responseType: "arraybuffer",
            },
        );
        const zipBuffer = Buffer.from(response.data);

        // Create output directory
        mkdirSync(outputDir, { recursive: true });

        // Extract zip contents
        const directory = await unzipper.Open.buffer(zipBuffer);
        await directory.extract({ path: outputDir });
    }

    async getInstance(PLAN_ID: string): Promise<TestInstance> {
        // Fetch the plan from demo server
        const plan = await this.instance
            .get(`/api/plan/${PLAN_ID}`)
            .then((res) => res.data);

        // Create a runner (testInstance) on the demo server using the first module
        const testInstance: TestInstance = await this.instance
            .post("/api/runner", undefined, {
                params: {
                    test: plan.modules[0].testModule,
                    plan: plan._id,
                },
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
            })
            .then((res) => res.data);

        // Poll until runner is in WAITING state. This is required before we request
        // presentation/authorization flows that the runner will handle.
        let state = "";
        const maxAttempts = 100;
        let attempts = 0;

        while (state !== "WAITING" && attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 300));
            const response = await this.instance.get<TestResult>(
                `/api/info/${testInstance.id}`,
            );
            state = response.data.status;
            attempts++;
        }

        if (state !== "WAITING") {
            throw new Error(
                `Test instance did not reach WAITING state after ${maxAttempts} attempts`,
            );
        }

        return testInstance;
    }

    async getResult(testInstanceId: string): Promise<string> {
        // Fetch the runner status and return the test result
        const response = await this.instance.get<TestResult>(
            `/api/info/${testInstanceId}`,
        );
        return response.data.result;
    }

    /**
     * Returns all plans exposed by the running OIDF suite.
     * The response shape can differ across suite versions, so we discover plan objects recursively.
     */
    async getAvailablePlans(): Promise<OIDFAvailablePlan[]> {
        const response = await this.instance.get("/api/plan/available");
        const rawData = response.data;

        const plansByName = new Map<string, OIDFAvailablePlan>();

        const walk = (value: unknown): void => {
            if (Array.isArray(value)) {
                for (const entry of value) {
                    walk(entry);
                }
                return;
            }

            if (value && typeof value === "object") {
                const record = value as Record<string, unknown>;

                const maybePlanName =
                    typeof record.planName === "string"
                        ? record.planName
                        : typeof record.plan === "string"
                          ? record.plan
                          : undefined;

                const profileNames = this.extractProfileNames(record);

                if (maybePlanName) {
                    const existing = plansByName.get(maybePlanName);
                    if (existing) {
                        existing.profileNames = [
                            ...new Set([
                                ...existing.profileNames,
                                ...profileNames,
                            ]),
                        ];
                    } else {
                        plansByName.set(maybePlanName, {
                            planName: maybePlanName,
                            profileNames,
                            protocols: this.detectProtocols(
                                maybePlanName,
                                profileNames,
                            ),
                            roles: this.detectRoles(
                                maybePlanName,
                                profileNames,
                            ),
                            isHaip: this.detectHaip(
                                maybePlanName,
                                profileNames,
                            ),
                        });
                    }
                }

                for (const nested of Object.values(record)) {
                    walk(nested);
                }
            }
        };

        walk(rawData);

        return [...plansByName.values()].sort((a, b) =>
            a.planName.localeCompare(b.planName),
        );
    }

    /**
     * Returns plans relevant for OID4VCI and/or OID4VP.
     */
    async getAvailableOid4Plans(
        protocols: OIDFProtocol[] = ["oid4vci", "oid4vp"],
    ): Promise<OIDFAvailablePlan[]> {
        const requested = new Set(protocols.map((protocol) => protocol));
        const plans = await this.getAvailablePlans();

        return plans.filter((plan) =>
            plan.protocols.some((protocol) => requested.has(protocol)),
        );
    }

    /**
     * Returns plans relevant for HAIP issuer/verifier testing.
     */
    async getAvailableHaipIssuerVerifierPlans(): Promise<OIDFAvailablePlan[]> {
        const plans = await this.getAvailableOid4Plans(["oid4vci", "oid4vp"]);

        return plans.filter(
            (plan) =>
                plan.isHaip &&
                plan.roles.some(
                    (role) => role === "issuer" || role === "verifier",
                ),
        );
    }

    private extractProfileNames(record: Record<string, unknown>): string[] {
        const rawProfiles = record.certificationProfileName;
        if (Array.isArray(rawProfiles)) {
            return rawProfiles.filter(
                (profile): profile is string => typeof profile === "string",
            );
        }

        if (typeof rawProfiles === "string") {
            return [rawProfiles];
        }

        return [];
    }

    private detectProtocols(
        planName: string,
        profileNames: string[],
    ): OIDFProtocol[] {
        const signal = `${planName} ${profileNames.join(" ")}`.toLowerCase();
        const protocols: OIDFProtocol[] = [];

        if (signal.includes("oid4vci")) {
            protocols.push("oid4vci");
        }

        if (signal.includes("oid4vp")) {
            protocols.push("oid4vp");
        }

        return protocols;
    }

    private detectRoles(planName: string, profileNames: string[]): OIDFRole[] {
        const signal = `${planName} ${profileNames.join(" ")}`.toLowerCase();
        const roles: OIDFRole[] = [];

        if (signal.includes("issuer")) {
            roles.push("issuer");
        }

        if (signal.includes("verifier")) {
            roles.push("verifier");
        }

        if (signal.includes("wallet")) {
            roles.push("wallet");
        }

        return roles;
    }

    private detectHaip(planName: string, profileNames: string[]): boolean {
        const signal = `${planName} ${profileNames.join(" ")}`.toLowerCase();
        return signal.includes("haip");
    }

    /**
     * Returns all available test modules for a given plan.
     */
    getAllTestsModules(planId: string) {
        return this.instance
            .get(`/api/plan/${planId}`)
            .then((res) => res.data.modules.map((module) => module.testModule));
    }

    /**
     * Returns all plan modules with their module-level variants.
     */
    async getPlanModules(planId: string): Promise<OIDFPlanModule[]> {
        const plan = await this.getPlan(planId);
        return (plan.modules ?? []).map((module: any) => ({
            testModule: String(module.testModule),
            variant: this.normalizeVariantRecord(module.variant),
        }));
    }

    /**
     * Builds a stable scenario key for coverage checks across plan and module variants.
     */
    buildScenarioKey(input: {
        testModule: string;
        planVariant?: Record<string, unknown>;
        moduleVariant?: Record<string, unknown>;
    }): string {
        const planVariant = this.normalizeVariantRecord(input.planVariant);
        const moduleVariant = this.normalizeVariantRecord(input.moduleVariant);

        const normalizedPlanVariant = this.sortRecord(planVariant);
        const normalizedModuleVariant = this.sortRecord(moduleVariant);

        return JSON.stringify({
            testModule: input.testModule,
            planVariant: normalizedPlanVariant,
            moduleVariant: normalizedModuleVariant,
        });
    }

    /**
     * Returns the plan data including variant information.
     */
    async getPlan(planId: string): Promise<any> {
        const response = await this.instance.get(`/api/plan/${planId}`);
        return response.data;
    }

    private normalizeVariantRecord(
        value?: Record<string, unknown>,
    ): Record<string, string> {
        if (!value || typeof value !== "object") {
            return {};
        }

        const record: Record<string, string> = {};
        for (const [key, raw] of Object.entries(value)) {
            if (raw === undefined || raw === null) {
                continue;
            }
            record[key] = String(raw);
        }

        return record;
    }

    private sortRecord(input: Record<string, string>): Record<string, string> {
        const sorted: Record<string, string> = {};
        for (const key of Object.keys(input).sort((a, b) =>
            a.localeCompare(b),
        )) {
            sorted[key] = input[key];
        }

        return sorted;
    }

    /**
     * Starts a test instance for a specific test module.
     * Fetches the variant from the plan's module configuration.
     */
    async startTest(planId: string, testName: string): Promise<TestInstance> {
        // Fetch the plan to get the variant for this specific test module
        const plan = await this.getPlan(planId);
        const module = plan.modules.find((m: any) => m.testModule === testName);

        if (!module) {
            throw new Error(
                `Test module '${testName}' not found in plan. Available: ${plan.modules.map((m: any) => m.testModule).join(", ")}`,
            );
        }

        // Get the variant from the module
        const variant = module.variant || {};

        try {
            const response = await this.instance.post(
                "/api/runner",
                undefined,
                {
                    params: {
                        test: testName,
                        plan: planId,
                        variant: JSON.stringify(variant),
                    },
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                },
            );
            return response.data;
        } catch (error: any) {
            console.error(
                "Error starting test:",
                error.response?.data || error.message,
            );
            throw error;
        }
    }

    async getEndpoint(testInstance: TestInstance): Promise<string> {
        let url: string | undefined;
        const maxAttempts = 100;
        let attempts = 0;

        while (!url && attempts < maxAttempts) {
            const response = await this.instance.get(
                `/api/runner/${testInstance.id}`,
            );
            url = response.data.exposed?.credential_offer_endpoint;
            if (!url) {
                await new Promise((r) => setTimeout(r, 300));
                attempts++;
            }
        }

        if (!url) {
            throw new Error(
                `Failed to get credential_offer_endpoint after ${maxAttempts} attempts`,
            );
        }

        return url;
    }

    async waitForFinished(testInstanceId: string): Promise<TestResult> {
        const maxAttempts = 100;
        let attempts = 0;
        let logResult: TestResult | undefined;

        while (
            (!logResult || logResult.status !== "FINISHED") &&
            attempts < maxAttempts
        ) {
            const response = await this.instance.get<TestResult>(
                `/api/info/${testInstanceId}`,
            );
            logResult = response.data;
            if (logResult.status !== "FINISHED") {
                await new Promise((r) => setTimeout(r, 300));
                attempts++;
            }
        }

        if (!logResult || logResult.status !== "FINISHED") {
            throw new Error(
                `Test did not finish after ${maxAttempts} attempts`,
            );
        }

        return logResult;
    }
}
