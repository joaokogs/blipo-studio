import {
  StudioError,
  resourceId,
  storageKind,
  type Diagnostic,
  type ResourceKind,
  type Scope,
} from "@/core/domain";
import type { FileStore, ProviderAdapter } from "@/core/ports";
import { assertCapability } from "./capability";

export interface ReadResourceInput {
  readonly adapter: ProviderAdapter;
  readonly fileStore: FileStore;
  readonly scope: Scope;
  readonly kind: ResourceKind;
  readonly name: string;
}

export interface ReadResourceResult {
  readonly resource: {
    readonly id: string;
    readonly provider: string;
    readonly kind: ResourceKind;
    readonly scope: Scope;
    readonly name: string;
    readonly description?: string;
    readonly mode?: string;
    readonly version: string;
  };
  readonly raw: string;
  readonly version: string;
  readonly diagnostics: readonly Diagnostic[];
}

export async function readResource(input: ReadResourceInput): Promise<ReadResourceResult> {
  assertCapability(input.adapter, {
    resourceKind: input.kind,
    scope: input.scope,
    operation: "read",
  });

  const file = await input.fileStore.read({
    scope: input.scope,
    storage: storageKind(input.kind),
    name: input.name,
  });

  if (!file) {
    throw new StudioError("not_found", "Recurso não encontrado.");
  }

  const parsed = input.adapter.parse(file.content, input.kind);

  return {
    resource: {
      id: resourceId({
        provider: input.adapter.providerId,
        kind: input.kind,
        scope: input.scope,
        name: input.name,
      }),
      provider: input.adapter.providerId,
      kind: input.kind,
      scope: input.scope,
      name: input.name,
      description: parsed.description,
      mode: parsed.mode,
      version: file.version,
    },
    raw: file.content,
    version: file.version,
    diagnostics: parsed.diagnostics,
  };
}
