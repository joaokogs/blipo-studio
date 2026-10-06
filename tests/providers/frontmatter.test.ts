import { describe, expect, it } from "vitest";
import { parseDocument, splitFrontmatter } from "@/providers/opencode/frontmatter";
import { openCodeAdapter } from "@/providers/opencode/adapter";
import { readFixture } from "../helpers/fixtures";

function hasErrorCode(
  diagnostics: readonly { severity: string; code: string }[],
  code: string,
): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error" && diagnostic.code === code);
}

describe("splitFrontmatter", () => {
  it("separa frontmatter e corpo", () => {
    const split = splitFrontmatter("---\na: 1\n---\ncorpo\n");
    expect(split.present).toBe(true);
    expect(split.closed).toBe(true);
    expect(split.yaml).toBe("a: 1");
    expect(split.body).toBe("corpo\n");
  });

  it("detecta ausência de frontmatter", () => {
    const split = splitFrontmatter("sem frontmatter");
    expect(split.present).toBe(false);
  });

  it("detecta frontmatter não fechado", () => {
    const split = splitFrontmatter("---\na: 1\ncorpo");
    expect(split.present).toBe(true);
    expect(split.closed).toBe(false);
  });
});

describe("parseDocument — agentes", () => {
  it("aceita agente primário válido", async () => {
    const parsed = parseDocument(await readFixture("agents", "valid-primary.md"), "agent");
    expect(parsed.mode).toBe("primary");
    expect(parsed.description).toContain("Revisa");
    expect(parsed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("aceita subagente válido", async () => {
    const parsed = parseDocument(await readFixture("agents", "valid-subagent.md"), "subagent");
    expect(parsed.mode).toBe("subagent");
    expect(parsed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("assume modo all quando ausente em agente", async () => {
    const parsed = parseDocument("---\ndescription: sem modo\n---\ncorpo", "agent");
    expect(parsed.mode).toBe("all");
    expect(parsed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });

  it("avisa sobre campos desconhecidos preservados", async () => {
    const raw = await readFixture("agents", "unknown-fields.md");
    const parsed = openCodeAdapter.parse(raw, "agent");
    expect(parsed.diagnostics.some((d) => d.code === "unknown_fields_preserved")).toBe(true);
    expect(parsed.data?.["x-custom-field"]).toBe("mantenha-me");
  });

  it("rejeita description com tipo incorreto", async () => {
    const parsed = parseDocument(await readFixture("invalid", "invalid-description.md"), "agent");
    expect(hasErrorCode(parsed.diagnostics, "invalid_description")).toBe(true);
  });

  it("rejeita chaves YAML duplicadas", async () => {
    const parsed = parseDocument(await readFixture("invalid", "duplicate-keys.md"), "agent");
    expect(hasErrorCode(parsed.diagnostics, "yaml_syntax")).toBe(true);
  });

  it("rejeita arquivo sem frontmatter", async () => {
    const parsed = parseDocument(await readFixture("invalid", "no-frontmatter.md"), "agent");
    expect(hasErrorCode(parsed.diagnostics, "missing_frontmatter")).toBe(true);
  });

  it("rejeita frontmatter não fechado", async () => {
    const parsed = parseDocument(await readFixture("invalid", "unclosed.md"), "agent");
    expect(hasErrorCode(parsed.diagnostics, "unclosed_frontmatter")).toBe(true);
  });
});

describe("parseDocument — skills", () => {
  it("aceita skill válida", async () => {
    const parsed = parseDocument(await readFixture("skills", "git-release", "SKILL.md"), "skill");
    expect(parsed.data?.name).toBe("git-release");
    expect(parsed.description).toContain("releases");
    expect(parsed.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  });
});
