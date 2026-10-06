import {
  StudioError,
  canPerform,
  type Operation,
  type ProviderDescriptor,
  type ResourceKind,
  type Scope,
} from "@/core/domain";
import type { ProviderAdapter } from "@/core/ports";

export function descriptorFor(adapter: ProviderAdapter): ProviderDescriptor {
  return {
    id: adapter.providerId,
    name: adapter.providerId,
    implementationStatus: "implemented",
    capabilities: adapter.capabilities(),
  };
}

export function assertCapability(
  adapter: ProviderAdapter,
  query: { resourceKind: ResourceKind; scope: Scope; operation: Operation },
): void {
  if (!canPerform(descriptorFor(adapter), query)) {
    throw new StudioError(
      "unsupported",
      `O provider ${adapter.providerId} não oferece a operação "${query.operation}" para ${query.resourceKind} no escopo ${query.scope}.`,
    );
  }
}
