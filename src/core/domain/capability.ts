import type { ResourceKind, Scope } from "./resource";

export type Operation = "list" | "create" | "read" | "update" | "delete";
export type CapabilityStatus = "planned" | "verified";

export const OPERATIONS: readonly Operation[] = ["list", "create", "read", "update", "delete"];

export interface Capability {
  readonly resourceKind: ResourceKind;
  readonly scope: Scope;
  readonly operation: Operation;
  readonly status: CapabilityStatus;
}
