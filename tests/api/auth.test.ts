import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET as getSession } from "@/app/api/session/route";
import { POST as postList } from "@/app/api/resources/list/route";
import { POST as postRead } from "@/app/api/resources/read/route";
import { POST as postValidate } from "@/app/api/resources/validate/route";
import { POST as postMutate } from "@/app/api/resources/mutate/route";
import { MAX_BODY_BYTES } from "@/app/api/_lib/http";

const token = "a".repeat(64);
const port = 4444;
const origin = `http://127.0.0.1:${port}`;

let base = "";

beforeAll(async () => {
  base = await mkdtemp(join(tmpdir(), "blipo-api-"));
  const workspace = join(base, "repo");
  await mkdir(workspace, { recursive: true });
  process.env.BLIPO_SESSION_TOKEN = token;
  process.env.BLIPO_WORKSPACE = workspace;
  process.env.BLIPO_GLOBAL_ROOT = join(base, "global");
  process.env.BLIPO_BACKUP_ROOT = join(base, "backups");
  process.env.BLIPO_PORT = String(port);
  process.env.BLIPO_ORIGIN = origin;
});

afterAll(async () => {
  delete process.env.BLIPO_SESSION_TOKEN;
  delete process.env.BLIPO_WORKSPACE;
  delete process.env.BLIPO_GLOBAL_ROOT;
  delete process.env.BLIPO_BACKUP_ROOT;
  delete process.env.BLIPO_PORT;
  delete process.env.BLIPO_ORIGIN;
  await rm(base, { recursive: true, force: true });
});

interface RequestOptions {
  method?: string;
  token?: string | null;
  host?: string;
  origin?: string | undefined;
  body?: unknown;
}

function buildRequest(path: string, options: RequestOptions = {}): Request {
  const headers = new Headers();
  headers.set("host", options.host ?? `127.0.0.1:${port}`);
  if (options.token !== null) {
    headers.set("x-blipo-token", options.token ?? token);
  }
  if (options.origin !== undefined) {
    headers.set("origin", options.origin);
  }
  const hasBody = options.body !== undefined;
  if (hasBody) {
    headers.set("content-type", "application/json");
  }
  return new Request(`http://127.0.0.1:${port}${path}`, {
    method: options.method ?? "POST",
    headers,
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });
}

describe("GET /api/session", () => {
  it("retorna a sessão autenticada sem expor o token", async () => {
    const response = await getSession(buildRequest("/api/session", { method: "GET" }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.workspace).toBeDefined();
    expect(body.backupRoot).toBeDefined();
    expect(typeof body.version).toBe("string");
    expect(body.capabilities).toHaveLength(3 * 2 * 5);
    expect(body.capabilities[0].provider).toBe("opencode");
    expect(JSON.stringify(body)).not.toContain(token);
  });

  it("falha fechado sem token (401)", async () => {
    const response = await getSession(buildRequest("/api/session", { method: "GET", token: null }));
    expect(response.status).toBe(401);
  });

  it("rejeita token incorreto (401)", async () => {
    const response = await getSession(
      buildRequest("/api/session", { method: "GET", token: "b".repeat(64) }),
    );
    expect(response.status).toBe(401);
  });

  it("rejeita Host diferente (403)", async () => {
    const response = await getSession(
      buildRequest("/api/session", { method: "GET", host: "localhost:4444" }),
    );
    expect(response.status).toBe(403);
  });
});

describe("autenticação e autorização", () => {
  it("rejeita Origin divergente em reads (403)", async () => {
    const response = await postList(
      buildRequest("/api/resources/list", { body: { provider: "opencode" }, origin: "http://evil.test" }),
    );
    expect(response.status).toBe(403);
  });

  it("exige Origin em mutações (403)", async () => {
    const response = await postMutate(
      buildRequest("/api/resources/mutate", {
        body: {
          provider: "opencode",
          action: "create",
          scope: "repository",
          kind: "agent",
          name: "sem-origin",
          content: "---\ndescription: x\nmode: primary\n---\n",
        },
      }),
    );
    expect(response.status).toBe(403);
  });

  it("rejeita provider não implementado (422)", async () => {
    const response = await postList(
      buildRequest("/api/resources/list", { body: { provider: "codex" } }),
    );
    expect(response.status).toBe(422);
  });

  it("rejeita caminho inseguro (422)", async () => {
    const response = await postRead(
      buildRequest("/api/resources/read", {
        body: { provider: "opencode", scope: "repository", kind: "agent", name: "../evil" },
      }),
    );
    expect(response.status).toBe(422);
  });

  it("rejeita corpo acima do limite (413)", async () => {
    const response = await postValidate(
      buildRequest("/api/resources/validate", {
        body: {
          provider: "opencode",
          scope: "repository",
          kind: "agent",
          name: "grande",
          content: "a".repeat(MAX_BODY_BYTES + 1024),
        },
      }),
    );
    expect(response.status).toBe(413);
  });
});

describe("fluxo de mutação autenticado", () => {
  it("cria e lista um agente", async () => {
    const createResponse = await postMutate(
      buildRequest("/api/resources/mutate", {
        origin,
        body: {
          provider: "opencode",
          action: "create",
          scope: "repository",
          kind: "agent",
          name: "api-agent",
          content: "---\ndescription: criado via API\nmode: primary\n---\n",
        },
      }),
    );
    expect(createResponse.status).toBe(200);

    const listResponse = await postList(
      buildRequest("/api/resources/list", {
        body: { provider: "opencode", scope: "repository" },
      }),
    );
    expect(listResponse.status).toBe(200);
    const body = await listResponse.json();
    expect(body.resources.map((resource: { name: string }) => resource.name)).toContain("api-agent");
  });

  it("retorna 422 para mutação inválida", async () => {
    const response = await postMutate(
      buildRequest("/api/resources/mutate", {
        origin,
        body: {
          provider: "opencode",
          action: "create",
          scope: "repository",
          kind: "subagent",
          name: "sem-mode",
          content: "---\ndescription: sem mode\n---\n",
        },
      }),
    );
    expect(response.status).toBe(422);
  });
});
