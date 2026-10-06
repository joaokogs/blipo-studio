import type { Capability, Operation } from "./capability";
import type { ResourceKind, Scope } from "./resource";

export type ProviderId = "opencode" | "codex" | "claude-code";
export type ProviderImplementationStatus = "planned" | "implemented";

export const PROVIDER_IDS: readonly ProviderId[] = ["opencode", "codex", "claude-code"];

export interface ProviderDescriptor {
  readonly id: ProviderId;
  readonly name: string;
  readonly implementationStatus: ProviderImplementationStatus;
  readonly capabilities: readonly Capability[];
}

export interface CapabilityQuery {
  readonly resourceKind: ResourceKind;
  readonly scope: Scope;
  readonly operation: Operation;
}

export function canPerform(provider: ProviderDescriptor, query: CapabilityQuery): boolean {
  if (provider.implementationStatus !== "implemented") {
    return false;
  }

  return provider.capabilities.some(
    (capability) =>
      capability.resourceKind === query.resourceKind &&
      capability.scope === query.scope &&
      capability.operation === query.operation &&
      capability.status === "verified",
  );
}
