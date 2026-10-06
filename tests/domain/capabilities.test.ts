import { describe, expect, it } from "vitest";
import { canPerform, type CapabilityQuery, type ProviderDescriptor } from "@/core/domain";

const verifiedCapability = {
  resourceKind: "agent",
  scope: "global",
  operation: "create",
  status: "verified",
} as const;

function implementedProvider(
  capabilities: ProviderDescriptor["capabilities"],
): ProviderDescriptor {
  return {
    id: "opencode",
    name: "OpenCode",
    implementationStatus: "implemented",
    capabilities,
  };
}

describe("canPerform", () => {
  it("nega provider planejado mesmo com capability verificada", () => {
    const provider: ProviderDescriptor = {
      ...implementedProvider([verifiedCapability]),
      implementationStatus: "planned",
    };

    expect(
      canPerform(provider, { resourceKind: "agent", scope: "global", operation: "create" }),
    ).toBe(false);
  });

  it("nega capability não verificada mesmo com provider implementado", () => {
    const provider = implementedProvider([{ ...verifiedCapability, status: "planned" }]);

    expect(
      canPerform(provider, { resourceKind: "agent", scope: "global", operation: "create" }),
    ).toBe(false);
  });

  it("permite provider implementado com capability verificada", () => {
    const provider = implementedProvider([verifiedCapability]);

    expect(
      canPerform(provider, { resourceKind: "agent", scope: "global", operation: "create" }),
    ).toBe(true);
  });

  it.each<{ label: string; query: CapabilityQuery }>([
    {
      label: "resourceKind",
      query: { resourceKind: "subagent", scope: "global", operation: "create" },
    },
    {
      label: "scope",
      query: { resourceKind: "agent", scope: "repository", operation: "create" },
    },
    {
      label: "operation",
      query: { resourceKind: "agent", scope: "global", operation: "read" },
    },
  ])("nega query divergindo somente em $label", ({ query }) => {
    const provider = implementedProvider([verifiedCapability]);

    expect(canPerform(provider, query)).toBe(false);
  });

  it("nega provider implementado sem capabilities", () => {
    const provider = implementedProvider([]);

    expect(
      canPerform(provider, { resourceKind: "agent", scope: "global", operation: "create" }),
    ).toBe(false);
  });
});
