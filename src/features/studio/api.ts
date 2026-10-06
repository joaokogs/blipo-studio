export interface Diagnostic {
  severity: "error" | "warning";
  code: string;
  message: string;
  path?: string;
}

export interface SessionInfo {
  workspace: string;
  backupRoot: string;
  origin: string;
  port: number;
  scopes: readonly string[];
  providers: readonly { id: string; name: string; implementationStatus: string }[];
  capabilities: readonly {
    provider: string;
    resourceKind: string;
    scope: string;
    operation: string;
    status: string;
  }[];
}

export interface ListedResource {
  id: string;
  provider: string;
  kind: "agent" | "subagent" | "skill";
  scope: "global" | "repository";
  name: string;
  description?: string;
  mode?: string;
  version: string;
  valid: boolean;
  diagnostics: readonly Diagnostic[];
}

export interface ListResponse {
  provider: string;
  resources: readonly ListedResource[];
  diagnostics: readonly Diagnostic[];
}

export interface ReadResponse {
  resource: ListedResource;
  raw: string;
  version: string;
  diagnostics: readonly Diagnostic[];
}

export interface ValidateResponse {
  provider: string;
  ok: boolean;
  diagnostics: readonly Diagnostic[];
  mode?: string;
  description?: string;
}

export interface BackupRef {
  id: string;
  path: string;
  createdAt: string;
}

export interface MutateResponse {
  action: "create" | "update" | "delete";
  report: {
    applied: number;
    backup?: BackupRef;
    result?: { content: string; version: string };
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function request<T>(
  token: string,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<T> {
  const headers: Record<string, string> = { "x-blipo-token": token };
  if (init.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(path, {
    method: init.method,
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const data = (await response.json().catch(() => null)) as
    | { error?: { code?: string; message?: string } }
    | T
    | null;

  if (!response.ok) {
    const error = (data as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      error?.message ?? `Erro ${response.status}.`,
      response.status,
      error?.code ?? "internal",
    );
  }

  return data as T;
}

export const studioApi = {
  getSession: (token: string) =>
    request<SessionInfo>(token, "/api/session", { method: "GET" }),
  list: (token: string, provider: string, scope?: string) =>
    request<ListResponse>(token, "/api/resources/list", {
      method: "POST",
      body: scope ? { provider, scope } : { provider },
    }),
  read: (token: string, body: { provider: string; scope: string; kind: string; name: string }) =>
    request<ReadResponse>(token, "/api/resources/read", { method: "POST", body }),
  validate: (
    token: string,
    body: { provider: string; scope: string; kind: string; name: string; content: string },
  ) => request<ValidateResponse>(token, "/api/resources/validate", { method: "POST", body }),
  template: (
    token: string,
    body: { provider: string; kind: string; name: string; description: string; mode?: string },
  ) => request<{ provider: string; content: string }>(token, "/api/resources/template", {
    method: "POST",
    body,
  }),
  mutate: (
    token: string,
    body:
      | { provider: string; action: "create"; scope: string; kind: string; name: string; content: string }
      | {
          provider: string;
          action: "update";
          scope: string;
          kind: string;
          name: string;
          content: string;
          expectedVersion: string;
        }
      | { provider: string; action: "delete"; scope: string; kind: string; name: string; expectedVersion: string },
  ) => request<MutateResponse>(token, "/api/resources/mutate", { method: "POST", body }),
};
