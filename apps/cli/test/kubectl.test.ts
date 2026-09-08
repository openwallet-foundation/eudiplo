import { describe, expect, it } from "vitest";
import {
    assertContextName,
    assertNamespace,
    assertWorkloadReference,
    buildCanIArgs,
    buildGetEndpointsArgs,
    buildGetPodsArgs,
    buildLogsArgs,
    buildRestartArgs,
    buildRolloutStatusArgs,
    resolveScope,
    resolveWorkload,
    resolveWorkloads,
} from "../src/services/kubectl.js";
import { unreadyEndpoints } from "../src/services/deployment-drivers.js";
import type { InstanceConfig } from "../src/types.js";

const scope = { context: "production", namespace: "eudiplo" };

const instance: InstanceConfig = {
    target: "kubernetes",
    url: "https://eudiplo.example.com",
    context: "production",
    namespace: "eudiplo",
    workloads: {
        backend: "deployment/eudiplo",
        client: "deployment/eudiplo-client",
    },
};

function scopeOf(args: string[]): string[] {
    const start = args.indexOf("--context");
    return start === -1 ? [] : args.slice(start, start + 4);
}

describe("kubectl argument construction", () => {
    const builders: Array<[string, string[]]> = [
        ["get pods", buildGetPodsArgs(scope)],
        ["logs", buildLogsArgs(scope, "deployment/eudiplo")],
        ["rollout restart", buildRestartArgs(scope, "deployment/eudiplo")],
        ["rollout status", buildRolloutStatusArgs(scope, "deployment/eudiplo")],
        ["auth can-i", buildCanIArgs(scope, "get", "pods")],
        ["get endpoints", buildGetEndpointsArgs(scope)],
    ];

    it.each(builders)(
        "%s carries an explicit context and namespace",
        (_name, args) => {
            expect(scopeOf(args)).toEqual([
                "--context",
                "production",
                "--namespace",
                "eudiplo",
            ]);
        },
    );

    it.each(builders)("%s never widens to all namespaces", (_name, args) => {
        expect(args).not.toContain("--all-namespaces");
        expect(args).not.toContain("-A");
    });

    it("follows and tails logs only when asked", () => {
        expect(buildLogsArgs(scope, "deployment/eudiplo")).not.toContain(
            "--follow",
        );
        expect(
            buildLogsArgs(scope, "deployment/eudiplo", {
                follow: true,
                tail: 100,
            }),
        ).toEqual([
            "logs",
            "deployment/eudiplo",
            "--context",
            "production",
            "--namespace",
            "eudiplo",
            "--follow",
            "--tail",
            "100",
        ]);
    });

    it("restarts through rollout rather than deleting pods", () => {
        const args = buildRestartArgs(scope, "deployment/eudiplo");

        expect(args.slice(0, 3)).toEqual([
            "rollout",
            "restart",
            "deployment/eudiplo",
        ]);
        expect(args).not.toContain("delete");
    });
});

describe("scope resolution", () => {
    it("refuses an instance without a context", () => {
        expect(() =>
            resolveScope({ ...instance, context: undefined }, "prod"),
        ).toThrow(/does not define a Kubernetes context/);
    });

    it("refuses an instance without a namespace", () => {
        expect(() =>
            resolveScope({ ...instance, namespace: undefined }, "prod"),
        ).toThrow(/does not define a Kubernetes namespace/);
    });
});

describe("workload resolution", () => {
    it("resolves a named service to its workload", () => {
        expect(resolveWorkload(instance, "backend")).toBe("deployment/eudiplo");
    });

    it("refuses to guess between several workloads", () => {
        expect(() => resolveWorkload(instance, undefined)).toThrow(
            /Name one with --service/,
        );
    });

    it("names the configured services when asked for an unknown one", () => {
        expect(() => resolveWorkload(instance, "database")).toThrow(
            /Configured services: backend, client/,
        );
    });

    it("resolves a single configured workload without --service", () => {
        const single: InstanceConfig = {
            ...instance,
            workloads: { backend: "deployment/eudiplo" },
        };

        expect(resolveWorkload(single, undefined)).toBe("deployment/eudiplo");
    });

    it("reports every workload for commands that span the instance", () => {
        expect(resolveWorkloads(instance, undefined)).toEqual([
            "deployment/eudiplo",
            "deployment/eudiplo-client",
        ]);
    });
});

describe("service endpoint readiness", () => {
    function endpointList(
        items: Array<{ name: string; addresses: number }>,
    ): string {
        return JSON.stringify({
            items: items.map(({ name, addresses }) => ({
                metadata: { name },
                subsets:
                    addresses > 0
                        ? [
                              {
                                  addresses: Array.from(
                                      { length: addresses },
                                      () => ({ ip: "10.0.0.1" }),
                                  ),
                              },
                          ]
                        : [],
            })),
        });
    }

    it("accepts services that have ready addresses", () => {
        expect(
            unreadyEndpoints(
                endpointList([
                    { name: "eudiplo", addresses: 2 },
                    { name: "eudiplo-client", addresses: 1 },
                ]),
            ),
        ).toEqual([]);
    });

    it("names services with no ready addresses", () => {
        expect(
            unreadyEndpoints(
                endpointList([
                    { name: "eudiplo", addresses: 1 },
                    { name: "eudiplo-client", addresses: 0 },
                ]),
            ),
        ).toEqual(["eudiplo-client"]);
    });

    it("treats a subset with an empty address list as unready", () => {
        expect(
            unreadyEndpoints(
                JSON.stringify({
                    items: [
                        {
                            metadata: { name: "eudiplo" },
                            subsets: [{ addresses: [] }],
                        },
                    ],
                }),
            ),
        ).toEqual(["eudiplo"]);
    });

    it("rejects a payload that is not an endpoints list", () => {
        expect(() => unreadyEndpoints(JSON.stringify({ kind: "Pod" }))).toThrow(
            /Unexpected endpoints payload/,
        );
    });
});

describe("configuration value validation", () => {
    it("rejects namespaces that could be read as flags", () => {
        expect(() => assertNamespace("--all-namespaces", "namespace")).toThrow(
            /DNS-1123 label/,
        );
        expect(() => assertNamespace("-eudiplo", "namespace")).toThrow();
    });

    it("rejects namespaces that are not DNS-1123 labels", () => {
        expect(() => assertNamespace("Eudiplo", "namespace")).toThrow();
        expect(() => assertNamespace("eudiplo prod", "namespace")).toThrow();
        expect(() => assertNamespace("eudiplo-", "namespace")).toThrow();
        expect(() => assertNamespace("eudiplo-prod", "namespace")).not.toThrow();
    });

    it("rejects context names that could be read as flags", () => {
        expect(() => assertContextName("--kubeconfig", "context")).toThrow();
        expect(() => assertContextName("", "context")).toThrow();
        expect(() => assertContextName("prod cluster", "context")).toThrow();
        expect(() =>
            assertContextName("arn:aws:eks:eu-central-1:123:cluster/prod", "context"),
        ).not.toThrow();
    });

    it("requires workloads to name a kind", () => {
        expect(() => assertWorkloadReference("eudiplo", "workload")).toThrow(
            /<kind>\/<name>/,
        );
        expect(() => assertWorkloadReference("--raw/x", "workload")).toThrow();
        expect(() =>
            assertWorkloadReference("deployment/eudiplo", "workload"),
        ).not.toThrow();
        expect(() =>
            assertWorkloadReference("statefulset/eudiplo-db", "workload"),
        ).not.toThrow();
    });
});
