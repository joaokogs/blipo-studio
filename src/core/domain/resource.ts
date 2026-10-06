export type ResourceKind = "agent" | "subagent" | "skill";
export type Scope = "global" | "repository";
export type AgentMode = "primary" | "subagent" | "all";
export type StorageKind = "agent" | "skill";

export const RESOURCE_KINDS: readonly ResourceKind[] = ["agent", "subagent", "skill"];
export const AGENT_KINDS: readonly ResourceKind[] = ["agent", "subagent"];
export const SCOPES: readonly Scope[] = ["global", "repository"];
export const AGENT_MODES: readonly AgentMode[] = ["primary", "subagent", "all"];

export interface Resource {
  readonly id: string;
  readonly provider: string;
  readonly kind: ResourceKind;
  readonly scope: Scope;
  readonly name: string;
  readonly description?: string;
  readonly mode?: AgentMode;
  readonly version?: string;
}

export interface ResourceIdentity {
  readonly provider: string;
  readonly kind: ResourceKind;
  readonly scope: Scope;
  readonly name: string;
}

export function storageKind(kind: ResourceKind): StorageKind {
  return kind === "skill" ? "skill" : "agent";
}

export function resourceId(identity: ResourceIdentity): string {
  return `${identity.provider}:${identity.scope}:${identity.kind}:${identity.name}`;
}

export function kindForAgentMode(mode: AgentMode | undefined): ResourceKind {
  return mode === "subagent" ? "subagent" : "agent";
}
