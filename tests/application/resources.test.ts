import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createResource,
  deleteResource,
  listResources,
  readResource,
  updateResource,
  validateResource,
} from "@/core/application";
import { FsFileStore } from "@/infrastructure/fs/fs-file-store";
import { openCodeAdapter } from "@/providers/opencode/adapter";

const created: string[] = [];

async function makeContext() {
  const base = await mkdtemp(join(tmpdir(), "blipo-app-"));
  created.push(base);
  const repositoryRoot = join(base, "repo");
  await mkdir(repositoryRoot, { recursive: true });
  const fileStore = new FsFileStore({
    repositoryRoot,
    globalRoot: join(base, "global"),
    backupRoot: join(base, "backups"),
  });
  return { fileStore, adapter: openCodeAdapter };
}

afterEach(async () => {
  for (const base of created.splice(0)) {
    await rm(base, { recursive: true, force: true });
  }
});

const primaryContent = "---\ndescription: agente de teste\nmode: primary\n---\ncorpo\n";
const subagentContent = "---\ndescription: subagente de teste\nmode: subagent\n---\ncorpo\n";
const skillContent = "---\nname: git-release\ndescription: releases\n---\ncorpo\n";

describe("casos de uso de recursos", () => {
  it("cria, lê, lista e atualiza um agente", async () => {
    const { fileStore, adapter } = await makeContext();

    const createdReport = await createResource({
      adapter,
      fileStore,
      scope: "repository",
      kind: "agent",
      name: "meu-agente",
      content: primaryContent,
    });
    expect(createdReport.applied).toBe(1);

    const read = await readResource({
      adapter,
      fileStore,
      scope: "repository",
      kind: "agent",
      name: "meu-agente",
    });
    expect(read.raw).toBe(primaryContent);
    expect(read.resource.mode).toBe("primary");

    const list = await listResources({ adapter, fileStore, scope: "repository" });
    expect(list.resources.map((resource) => resource.name)).toContain("meu-agente");
    expect(list.resources[0]?.valid).toBe(true);

    const updated = await updateResource({
      adapter,
      fileStore,
      scope: "repository",
      kind: "agent",
      name: "meu-agente",
      content: "---\ndescription: atualizado\nmode: primary\n---\nnovo\n",
      expectedVersion: read.version,
    });
    expect(updated.backup).toBeDefined();
  });

  it("classifica subagentes pelo mode ao listar", async () => {
    const { fileStore, adapter } = await makeContext();
    await createResource({
      adapter,
      fileStore,
      scope: "repository",
      kind: "subagent",
      name: "revisor",
      content: subagentContent,
    });

    const list = await listResources({ adapter, fileStore, scope: "repository" });
    const resource = list.resources.find((item) => item.name === "revisor");
    expect(resource?.kind).toBe("subagent");
    expect(resource?.mode).toBe("subagent");
  });

  it("preserva agente sem mode como modo all", async () => {
    const { fileStore, adapter } = await makeContext();
    const raw = "---\ndescription: sem mode\n---\ncorpo\n";
    await createResource({
      adapter,
      fileStore,
      scope: "repository",
      kind: "agent",
      name: "sem-mode-agent",
      content: raw,
    });

    const read = await readResource({
      adapter,
      fileStore,
      scope: "repository",
      kind: "agent",
      name: "sem-mode-agent",
    });
    expect(read.resource.mode).toBe("all");
    expect(read.raw).toBe(raw);

    const list = await listResources({ adapter, fileStore, scope: "repository" });
    expect(list.resources.find((item) => item.name === "sem-mode-agent")?.mode).toBe("all");
  });

  it("remove skill sem tocar em outros arquivos", async () => {
    const { fileStore, adapter } = await makeContext();
    await createResource({
      adapter,
      fileStore,
      scope: "repository",
      kind: "skill",
      name: "git-release",
      content: skillContent,
    });
    const read = await readResource({
      adapter,
      fileStore,
      scope: "repository",
      kind: "skill",
      name: "git-release",
    });

    const report = await deleteResource({
      adapter,
      fileStore,
      scope: "repository",
      kind: "skill",
      name: "git-release",
      expectedVersion: read.version,
    });
    expect(report.backup).toBeDefined();
  });

  it("recusa criação inválida antes de tocar o disco", async () => {
    const { fileStore, adapter } = await makeContext();
    await expect(
      createResource({
        adapter,
        fileStore,
        scope: "repository",
        kind: "subagent",
        name: "sem-mode",
        content: "---\ndescription: sem mode\n---\n",
      }),
    ).rejects.toMatchObject({ code: "validation_error" });
  });

  it("valida conteúdo sem I/O", () => {
    const result = validateResource({
      adapter: openCodeAdapter,
      scope: "repository",
      kind: "agent",
      name: "x",
      content: primaryContent,
    });
    expect(result.ok).toBe(true);
  });
});
