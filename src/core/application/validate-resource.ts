import type { ResourceKind, Scope } from "@/core/domain";
import type { ProviderAdapter, ValidationResult } from "@/core/ports";

export interface ValidateResourceInput {
  readonly adapter: ProviderAdapter;
  readonly scope: Scope;
  readonly kind: ResourceKind;
  readonly name: string;
  readonly content: string;
}

export interface ValidateResourceResult extends ValidationResult {
  readonly provider: string;
}

export function validateResource(input: ValidateResourceInput): ValidateResourceResult {
  const result = input.adapter.validate({
    scope: input.scope,
    kind: input.kind,
    name: input.name,
    content: input.content,
  });

  return { ...result, provider: input.adapter.providerId };
}
