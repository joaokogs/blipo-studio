import { StudioError, type ResourceKind, type Scope } from "@/core/domain";
import type { ApplyReport, FileStore, ProviderAdapter } from "@/core/ports";
import { assertCapability } from "./capability";

export interface DeleteResourceInput {
  readonly adapter: ProviderAdapter;
  readonly fileStore: FileStore;
  readonly scope: Scope;
  readonly kind: ResourceKind;
  readonly name: string;
  readonly expectedVersion: string;
}

export async function deleteResource(input: DeleteResourceInput): Promise<ApplyReport> {
  assertCapability(input.adapter, {
    resourceKind: input.kind,
    scope: input.scope,
    operation: "delete",
  });

  if (!input.expectedVersion) {
    throw new StudioError(
      "validation_error",
      "expectedVersion é obrigatório para remover (verificação de conflito).",
    );
  }

  const plan = input.adapter.planChanges({
    operation: "delete",
    scope: input.scope,
    kind: input.kind,
    name: input.name,
    expectedVersion: input.expectedVersion,
  });

  return input.fileStore.apply(plan);
}
