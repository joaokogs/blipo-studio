import { describe, expect, it } from "vitest";
import { providerCatalog } from "@/providers/catalog";

describe("providerCatalog", () => {
  it("lista os três providers na ordem esperada", () => {
    const providers = providerCatalog.listProviders();

    expect(providers.map((provider) => provider.id)).toEqual([
      "opencode",
      "codex",
      "claude-code",
    ]);
  });

  it("marca apenas o OpenCode como implementado", () => {
    const providers = providerCatalog.listProviders();
    const opencode = providers.find((provider) => provider.id === "opencode");
    const others = providers.filter((provider) => provider.id !== "opencode");

    expect(opencode?.implementationStatus).toBe("implemented");
    expect(opencode?.capabilities.length).toBe(3 * 2 * 5);
    expect(opencode?.capabilities.every((capability) => capability.status === "verified")).toBe(
      true,
    );
    expect(others.every((provider) => provider.implementationStatus === "planned")).toBe(true);
    expect(others.every((provider) => provider.capabilities.length === 0)).toBe(true);
  });
});
