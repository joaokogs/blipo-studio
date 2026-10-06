import type { ProviderDescriptor } from "@/core/domain";
import type { ProviderCatalog } from "@/core/ports";

export function listProviders(catalog: ProviderCatalog): readonly ProviderDescriptor[] {
  return catalog.listProviders();
}
