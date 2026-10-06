import type { ProviderDescriptor } from "@/core/domain";
import type { ProviderCatalog } from "@/core/ports";

const providers: readonly ProviderDescriptor[] = [
  {
    id: "opencode",
    name: "OpenCode",
    implementationStatus: "planned",
    capabilities: [],
  },
  {
    id: "codex",
    name: "Codex",
    implementationStatus: "planned",
    capabilities: [],
  },
  {
    id: "claude-code",
    name: "Claude Code",
    implementationStatus: "planned",
    capabilities: [],
  },
];

export const providerCatalog: ProviderCatalog = {
  listProviders: () => providers,
};
