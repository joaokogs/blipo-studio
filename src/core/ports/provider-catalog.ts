import type { ProviderDescriptor } from "@/core/domain";

export interface ProviderCatalog {
  listProviders(): readonly ProviderDescriptor[];
}
