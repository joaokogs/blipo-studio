import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FsFileStore, MAX_FILE_BYTES, MAX_LIST_FILES } from "@/infrastructure/fs/fs-file-store";
import type { LogicalTarget } from "@/core/ports";

interface Sandbox {
  base: string;
  repositoryRoot: string;
  globalRoot: string;
  backupRoot: string;
  store: FsFileStore;
}

const created: string[] = [];

async function makeStore(backupRootOverride?: string): Promise<Sandbox> {
  const base = await mkdtemp(join(tmpdir(), "blipo-fs-"));
  created.push(base);
  const repositoryRoot = join(base, "repo");
  const globalRoot = join(base, "global");
  const backupRoot = backupRootOverride ?? join(base, "backups");
  await mkdir(repositoryRoot, { recursive: true });
  const store = new FsFileStore({ repositoryRoot, globalRoot, backupRoot });
  return { base, repositoryRoot, globalRoot, backupRoot, store };
}

afterEach(async () => {
  for (const base of created.splice(0)) {
    await rm(base, { recursive: true, force: true });
  }
});

const repoAgent = (name: string): LogicalTarget => ({ scope: "repository", storage: "agent", name });
const repoSKill = (name: string): LogicalTarget => ({ scope: "repository", storage: "skill", name });

describe("FsFileStore CRUD", () => {
  it("cria e lê agente no escopo repositório", async () => {
    const { store, repositoryRoot } = await makeStore();
    const content = "---\ndescription: teste\nmode: primary\n---\ncorpo\n";

    const report = await store.create(repoAgent("meu-agente"), content);
    expect(report.applied).toBe(1);
    expect(report.result?.version).toHaveLength(64);

    const stored = await readFile(join(repositoryRoot, ".opencode", "agents", "meu-agente.md"), "utf8");
    expect(stored).toBe(content);

    const read = await store.read(repoAgent("meu-agente"));
    expect(read?.content).toBe(content);
    expect(read?.version).toBe(report.result?.version);
  });

  it("cria e lê skill no escopo global", async () => {
    const { store, globalRoot } = await makeStore();
    const content = "---\nname: git-release\ndescription: releases\n---\ncorpo\n";

    await store.create({ scope: "global", storage: "skill", name: "git-release" }, content);
    const stored = await readFile(join(globalRoot, "skills", "git-release", "SKILL.md"), "utf8");
    expect(stored).toBe(content);
  });

  it("não sobrescreve no create (colisão entre agente e subagente)", async () => {
    const { store } = await makeStore();
    await store.create(repoAgent("mesmo-nome"), "---\ndescription: a\n---\n");
    await expect(store.create(repoAgent("mesmo-nome"), "---\ndescription: b\n---\n")).rejects.toMatchObject({
      code: "conflict",
    });
  });

  it("detecta conflito de versão no update e preserva o original", async () => {
    const { store, repositoryRoot } = await makeStore();
    const original = "---\ndescription: original\n---\n";
    const report = await store.create(repoAgent("conf"), original);

    await expect(
      store.apply({
        operations: [
          {
            type: "update",
            target: repoAgent("conf"),
            content: "---\ndescription: novo\n---\n",
            expectedVersion: "hash-errado",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "conflict" });

    expect(await readFile(join(repositoryRoot, ".opencode", "agents", "conf.md"), "utf8")).toBe(original);
    expect(report.result?.version).toBeDefined();
  });

  it("atualiza com backup e nova versão", async () => {
    const { store, backupRoot } = await makeStore();
    const first = await store.create(repoAgent("up"), "---\ndescription: v1\n---\n");
    const version = first.result?.version ?? "";

    const report = await store.apply({
      operations: [
        {
          type: "update",
          target: repoAgent("up"),
          content: "---\ndescription: v2\n---\n",
          expectedVersion: version,
        },
      ],
    });

    expect(report.backup).toBeDefined();
    expect(report.result?.version).not.toBe(version);
    expect(await store.read(repoAgent("up"))).toMatchObject({ content: "---\ndescription: v2\n---\n" });

    const backupContents = await readFile(join(backupRoot, report.backup?.id ?? "", "up.md"), "utf8");
    expect(backupContents).toBe("---\ndescription: v1\n---\n");
  });

  it("remove skill com backup preservando assets e a pasta", async () => {
    const { store, globalRoot, backupRoot } = await makeStore();
    const target = { scope: "global" as const, storage: "skill" as const, name: "git-release" };
    const created = await store.create(target, "---\nname: git-release\ndescription: x\n---\n");

    const skillDir = join(globalRoot, "skills", "git-release");
    await writeFile(join(skillDir, "note.txt"), "asset");

    const report = await store.apply({
      operations: [
        {
          type: "delete",
          target,
          expectedVersion: created.result?.version ?? "",
        },
      ],
    });

    expect(report.backup).toBeDefined();
    await expect(readFile(join(skillDir, "SKILL.md"), "utf8")).rejects.toThrow();
    expect(await readFile(join(skillDir, "note.txt"), "utf8")).toBe("asset");
    expect(await readFile(join(backupRoot, report.backup?.id ?? "", "SKILL.md"), "utf8")).toContain(
      "git-release",
    );
  });

  it("aborta o update quando o backup falha sem alterar o original", async () => {
    const { base, repositoryRoot } = await makeStore();
    const badBackupRoot = join(base, "not-a-directory");
    await writeFile(badBackupRoot, "arquivo");

    const store = new FsFileStore({
      repositoryRoot,
      globalRoot: join(base, "global"),
      backupRoot: badBackupRoot,
    });
    const original = "---\ndescription: intacto\n---\n";
    const created = await store.create(repoAgent("bk"), original);

    await expect(
      store.apply({
        operations: [
          {
            type: "update",
            target: repoAgent("bk"),
            content: "---\ndescription: novo\n---\n",
            expectedVersion: created.result?.version ?? "",
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "backup_failed" });

    expect(await readFile(join(repositoryRoot, ".opencode", "agents", "bk.md"), "utf8")).toBe(original);
  });
});

describe("FsFileStore.list", () => {
  it("lista agentes e skills de ambos os escopos", async () => {
    const { store } = await makeStore();
    await store.create(repoAgent("a1"), "---\ndescription: a\n---\n");
    await store.create(repoSKill("s1"), "---\nname: s1\ndescription: s\n---\n");
    await store.create({ scope: "global", storage: "agent", name: "g1" }, "---\ndescription: g\n---\n");

    const repository = await store.list("repository");
    expect(repository.files.map((file) => file.target.name).sort()).toEqual(["a1", "s1"]);

    const global = await store.list("global");
    expect(global.files.map((file) => file.target.name)).toEqual(["g1"]);
  });

  it("reporta nomes inválidos sem ocultar o arquivo", async () => {
    const { store, repositoryRoot } = await makeStore();
    await mkdir(join(repositoryRoot, ".opencode", "agents"), { recursive: true });
    await writeFile(join(repositoryRoot, ".opencode", "agents", "Nome Invalido.md"), "x");

    const report = await store.list("repository");
    expect(report.issues.some((issue) => issue.code === "invalid_name")).toBe(true);
  });

  it("recusa e reporta diretórios com link/junction", async () => {
    const { store, repositoryRoot, base } = await makeStore();
    await mkdir(join(repositoryRoot, ".opencode"), { recursive: true });
    const outside = join(base, "outside-agents");
    await mkdir(outside, { recursive: true });
    await writeFile(join(outside, "evil.md"), "---\ndescription: evil\n---\n");
    await symlink(outside, join(repositoryRoot, ".opencode", "agents"), "junction");

    const report = await store.list("repository");
    expect(report.issues.some((issue) => issue.path === "agents")).toBe(true);
    await expect(store.read(repoAgent("evil"))).rejects.toMatchObject({ code: "unsafe_path" });
  });

  it("respeita o limite de leitura de 1MiB", async () => {
    const { store, repositoryRoot } = await makeStore();
    await mkdir(join(repositoryRoot, ".opencode", "agents"), { recursive: true });
    await writeFile(
      join(repositoryRoot, ".opencode", "agents", "big.md"),
      "a".repeat(MAX_FILE_BYTES + 10),
    );

    await expect(store.read(repoAgent("big"))).rejects.toMatchObject({ code: "payload_too_large" });
    const report = await store.list("repository");
    expect(report.issues.some((issue) => issue.code === "payload_too_large")).toBe(true);
  });

  it(
    "trunca a listagem com diagnóstico explícito ao exceder o limite",
    async () => {
      const { store, repositoryRoot } = await makeStore();
      const agentsDir = join(repositoryRoot, ".opencode", "agents");
      await mkdir(agentsDir, { recursive: true });

      const total = MAX_LIST_FILES + 5;
      await Promise.all(
        Array.from({ length: total }, (_, index) =>
          writeFile(join(agentsDir, `agent-${index}.md`), "---\ndescription: x\n---\n"),
        ),
      );

      const report = await store.list("repository");
      expect(report.files.length).toBeLessThanOrEqual(MAX_LIST_FILES);
      expect(report.issues.some((issue) => issue.code === "list_truncated")).toBe(true);
    },
    30_000,
  );
});

describe("FsFileStore segurança de nomes", () => {
  it.each([
    ["traversal", "../evil"],
    ["separador inverso", "a\\b"],
    ["barra", "a/b"],
    ["drive", "C:\\evil"],
    ["reservado", "con"],
    ["ponto", "."],
  ])("rejeita nome %s", async (_label, name) => {
    const { store } = await makeStore();
    await expect(store.read({ scope: "repository", storage: "agent", name })).rejects.toMatchObject({
      code: "unsafe_path",
    });
  });
});
