import { describe, expect, it } from "vitest";
import { providerCatalog } from "@/providers/catalog";

describe("providerCatalog", () => {
  it("lista os três providers planejados", () => {
    const providers = providerCatalog.listProviders();

    expect(providers.map((provider) => provider.id)).toEqual([
      "opencode",
      "codex",
      "claude-code",
    ]);
    expect(providers.every((provider) => provider.implementationStatus === "planned")).toBe(true);
  });

  it("não declara capabilities sem matriz validada", () => {
    for (const provider of providerCatalog.listProviders()) {
      expect(provider.capabilities).toEqual([]);
    }
  });
});
