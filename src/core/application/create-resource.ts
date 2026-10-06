import { StudioError, type ResourceKind, type Scope } from "@/core/domain";
import type { ApplyReport, FileStore, ProviderAdapter } from "@/core/ports";
import { assertCapability } from "./capability";
import { firstErrorOr } from "./validation";

export interface CreateResourceInput {
  readonly adapter: ProviderAdapter;
  readonly fileStore: FileStore;
  readonly scope: Scope;
  readonly kind: ResourceKind;
  readonly name: string;
  readonly content: string;
}

export async function createResource(input: CreateResourceInput): Promise<ApplyReport> {
  assertCapability(input.adapter, {
    resourceKind: input.kind,
    scope: input.scope,
    operation: "create",
  });

  const validation = input.adapter.validate({
    scope: input.scope,
    kind: input.kind,
    name: input.name,
    content: input.content,
  });

  if (!validation.ok) {
    throw new StudioError(
      "validation_error",
      firstErrorOr(validation, "Conteúdo inválido para criação."),
    );
  }

  const plan = input.adapter.planChanges({
    operation: "create",
    scope: input.scope,
    kind: input.kind,
    name: input.name,
    content: input.content,
  });

  return input.fileStore.apply(plan);
}
