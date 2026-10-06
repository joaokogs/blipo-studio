import type {
  AgentMode,
  Capability,
  Diagnostic,
  Operation,
  ProviderId,
  ResourceKind,
  Scope,
} from "@/core/domain";
import type { FileChangePlan } from "./file-store";

export interface ResourceRef {
  readonly provider: ProviderId;
  readonly scope: Scope;
  readonly kind: ResourceKind;
  readonly name: string;
}

export interface ValidationInput {
  readonly scope: Scope;
  readonly kind: ResourceKind;
  readonly name: string;
  readonly content: string;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly diagnostics: readonly Diagnostic[];
  readonly mode?: AgentMode;
  readonly description?: string;
  readonly disableModelInvocation?: boolean;
}

export interface ParsedFrontmatter {
  readonly diagnostics: readonly Diagnostic[];
  readonly data?: Record<string, unknown>;
  readonly mode?: AgentMode;
  readonly description?: string;
  readonly disableModelInvocation?: boolean;
}

export interface ResourceChangeRequest {
  readonly operation: Operation;
  readonly scope: Scope;
  readonly kind: ResourceKind;
  readonly name: string;
  readonly mode?: AgentMode;
  readonly content?: string;
  readonly expectedVersion?: string;
}

export interface ProviderAdapter {
  readonly providerId: ProviderId;
  capabilities(): readonly Capability[];
  parse(content: string, kind: ResourceKind): ParsedFrontmatter;
  validate(input: ValidationInput): ValidationResult;
  planChanges(request: ResourceChangeRequest): FileChangePlan;
}
