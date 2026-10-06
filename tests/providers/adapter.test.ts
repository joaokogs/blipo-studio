import { describe, expect, it } from "vitest";
import { openCodeAdapter } from "@/providers/opencode/adapter";
import { buildTemplate } from "@/providers/opencode/template";
import { readFixture } from "../helpers/fixtures";
import { fixturePath } from "../helpers/fixtures";
import { readFile } from "node:fs/promises";

function errorMessages(content: string, kind: "agent" | "subagent" | "skill", name: string) {
  return openCodeAdapter
    .validate({ scope: "repository", kind, name, content })
    .diagnostics.filter((diagnostic) => diagnostic.severity === "error");
}

describe("openCodeAdapter.capabilities", () => {
  it("declara todas as combinações como verificadas", () => {
    const capabilities = openCodeAdapter.capabilities();
    expect(capabilities).toHaveLength(3 * 2 * 5);
    expect(capabilities.every((capability) => capability.status === "verified")).toBe(true);
  });

  it("inclui a operação list", () => {
    expect(
      openCodeAdapter.capabilities().some((capability) => capability.operation === "list"),
    ).toBe(true);
  });
});

describe("openCodeAdapter.validate", () => {
  it("rejeita subagente sem mode subagent", async () => {
    const content = await readFixture("agents", "valid-primary.md");
    const errors = errorMessages(content, "subagent", "valid-primary");
    expect(errors.some((diagnostic) => diagnostic.code === "mode_mismatch")).toBe(true);
  });

  it("rejeita agente primário com mode subagent", async () => {
    const content = await readFixture("agents", "valid-subagent.md");
    const errors = errorMessages(content, "agent", "valid-subagent");
    expect(errors.some((diagnostic) => diagnostic.code === "mode_mismatch")).toBe(true);
  });

  it("rejeita skill com name divergente do diretório", async () => {
    const content = await readFixture("invalid", "skill-name-mismatch", "SKILL.md");
    const errors = errorMessages(content, "skill", "outro-nome");
    expect(errors.some((diagnostic) => diagnostic.code === "skill_name_mismatch")).toBe(true);
  });

  it("rejeita nome de recurso inválido", () => {
    const errors = errorMessages("---\ndescription: ok\n---\n", "agent", "Nome Invalido");
    expect(errors.some((diagnostic) => diagnostic.code === "invalid_name")).toBe(true);
  });

  it("aceita recurso válido", async () => {
    const content = await readFixture("agents", "valid-subagent.md");
    const result = openCodeAdapter.validate({
      scope: "repository",
      kind: "subagent",
      name: "valid-subagent",
      content,
    });
    expect(result.ok).toBe(true);
  });
});

describe("openCodeAdapter.planChanges", () => {
  it("planeja create com storage de agente", () => {
    const plan = openCodeAdapter.planChanges({
      operation: "create",
      scope: "repository",
      kind: "subagent",
      name: "reviewer",
      content: "x",
    });
    expect(plan.operations).toHaveLength(1);
    expect(plan.operations[0]).toMatchObject({
      type: "create",
      target: { scope: "repository", storage: "agent", name: "reviewer" },
    });
  });

  it("planeja delete de skill com storage skill", () => {
    const plan = openCodeAdapter.planChanges({
      operation: "delete",
      scope: "global",
      kind: "skill",
      name: "git-release",
      expectedVersion: "v1",
    });
    expect(plan.operations[0]).toMatchObject({
      type: "delete",
      target: { scope: "global", storage: "skill", name: "git-release" },
      expectedVersion: "v1",
    });
  });
});

describe("buildTemplate", () => {
  it("gera template de agente validável", () => {
    const content = buildTemplate({
      kind: "agent",
      name: "reviewer",
      description: "Revisa código",
      mode: "primary",
    });
    const result = openCodeAdapter.validate({
      scope: "repository",
      kind: "agent",
      name: "reviewer",
      content,
    });
    expect(result.ok).toBe(true);
  });

  it("usa mode primary por padrão em novo agente", () => {
    const content = buildTemplate({ kind: "agent", name: "novo", description: "Novo agente" });
    expect(content).toContain("mode: primary");
    expect(content).not.toContain("mode: all");
  });

  it("usa mode subagent por padrão em novo subagente", () => {
    const content = buildTemplate({
      kind: "subagent",
      name: "novo-sub",
      description: "Novo subagente",
    });
    expect(content).toContain("mode: subagent");
  });

  it("preserva mode all existente como agente válido", () => {
    const result = openCodeAdapter.validate({
      scope: "repository",
      kind: "agent",
      name: "existente",
      content: "---\ndescription: existente\nmode: all\n---\n",
    });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("all");
  });

  it("gera template de skill validável", () => {
    const content = buildTemplate({
      kind: "skill",
      name: "git-release",
      description: "Releases",
    });
    const result = openCodeAdapter.validate({
      scope: "repository",
      kind: "skill",
      name: "git-release",
      content,
    });
    expect(result.ok).toBe(true);
  });

  it("preserva asset de fixture intacto", async () => {
    const original = await readFile(fixturePath("skills", "git-release", "assets", "note.txt"), "utf8");
    expect(original).toContain("Conteúdo auxiliar");
  });
});
