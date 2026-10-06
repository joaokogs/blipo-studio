import {
  SCOPES,
  hasError,
  kindForAgentMode,
  resourceId,
  type Diagnostic,
  type Resource,
  type Scope,
} from "@/core/domain";
import type { FileStore, ProviderAdapter } from "@/core/ports";
import { assertCapability } from "./capability";

export interface ListedResource extends Resource {
  readonly valid: boolean;
  readonly diagnostics: readonly Diagnostic[];
}

export interface ListResourcesInput {
  readonly adapter: ProviderAdapter;
  readonly fileStore: FileStore;
  readonly scope?: Scope;
}

export interface ListResourcesResult {
  readonly resources: readonly ListedResource[];
  readonly diagnostics: readonly Diagnostic[];
}

export async function listResources(input: ListResourcesInput): Promise<ListResourcesResult> {
  const scopes: readonly Scope[] = input.scope ? [input.scope] : SCOPES;
  const resources: ListedResource[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const scope of scopes) {
    assertCapability(input.adapter, { resourceKind: "agent", scope, operation: "list" });
    assertCapability(input.adapter, { resourceKind: "skill", scope, operation: "list" });

    const report = await input.fileStore.list(scope);

    for (const issue of report.issues) {
      diagnostics.push({
        severity: "error",
        code: `scan_${issue.code}`,
        message: issue.message,
        path: `${scope}/${issue.path}`,
      });
    }

    for (const file of report.files) {
      const parsed = input.adapter.parse(
        file.raw,
        file.target.storage === "skill" ? "skill" : "agent",
      );
      const kind = file.target.storage === "skill" ? "skill" : kindForAgentMode(parsed.mode);
      const valid = !hasError(parsed.diagnostics);

      for (const diagnostic of parsed.diagnostics) {
        diagnostics.push({ ...diagnostic, path: `${scope}/${file.target.name}` });
      }

      resources.push({
        id: resourceId({
          provider: input.adapter.providerId,
          scope,
          kind,
          name: file.target.name,
        }),
        provider: input.adapter.providerId,
        kind,
        scope,
        name: file.target.name,
        description: parsed.description,
        mode: parsed.mode,
        version: file.version,
        valid,
        diagnostics: parsed.diagnostics,
      });
    }
  }

  return { resources, diagnostics };
}
