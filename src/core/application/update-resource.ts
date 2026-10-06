import { StudioError, type ResourceKind, type Scope } from "@/core/domain";
import type { ApplyReport, FileStore, ProviderAdapter } from "@/core/ports";
import { assertCapability } from "./capability";
import { firstErrorOr } from "./validation";

export interface UpdateResourceInput {
  readonly adapter: ProviderAdapter;
  readonly fileStore: FileStore;
  readonly scope: Scope;
  readonly kind: ResourceKind;
  readonly name: string;
  readonly content: string;
  readonly expectedVersion: string;
}

export async function updateResource(input: UpdateResourceInput): Promise<ApplyReport> {
  assertCapability(input.adapter, {
    resourceKind: input.kind,
    scope: input.scope,
    operation: "update",
  });

  if (!input.expectedVersion) {
    throw new StudioError(
      "validation_error",
      "expectedVersion é obrigatório para atualizar (verificação de conflito).",
    );
  }

  const validation = input.adapter.validate({
    scope: input.scope,
    kind: input.kind,
    name: input.name,
    content: input.content,
  });

  if (!validation.ok) {
    throw new StudioError(
      "validation_error",
      firstErrorOr(validation, "Conteúdo inválido para atualização."),
    );
  }

  const plan = input.adapter.planChanges({
    operation: "update",
    scope: input.scope,
    kind: input.kind,
    name: input.name,
    content: input.content,
    expectedVersion: input.expectedVersion,
  });

  return input.fileStore.apply(plan);
}
