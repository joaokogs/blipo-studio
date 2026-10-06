export type ResourceKind = "agent" | "subagent" | "skill";
export type Scope = "global" | "repository";

export const RESOURCE_KINDS: readonly ResourceKind[] = ["agent", "subagent", "skill"];
export const SCOPES: readonly Scope[] = ["global", "repository"];

export interface Resource {
  readonly id: string;
  readonly kind: ResourceKind;
  readonly scope: Scope;
  readonly name: string;
  readonly description?: string;
}
