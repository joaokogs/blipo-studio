import { describe, expect, it } from "vitest";
import type { ProviderCatalog } from "@/core/ports";
import { listProviders } from "@/core/application";

describe("listProviders", () => {
  it("delega para o catálogo de providers", () => {
    const descriptors = [
      { id: "codex", name: "Codex", implementationStatus: "planned", capabilities: [] },
    ] as const;
    const catalog: ProviderCatalog = { listProviders: () => descriptors };

    expect(listProviders(catalog)).toBe(descriptors);
  });
});
