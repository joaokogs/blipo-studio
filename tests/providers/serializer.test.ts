import { describe, expect, it } from "vitest";
import { openCodeAdapter } from "@/providers/opencode/adapter";
import {
  readDisableModelInvocation,
  writeDisableModelInvocation,
} from "@/providers/opencode/serializer";

const FIELD = "disable-model-invocation";

function occurrences(haystack: string): number {
  return haystack.split(FIELD).length - 1;
}

describe("readDisableModelInvocation", () => {
  it("lê true e false", () => {
    expect(readDisableModelInvocation(`---\n${FIELD}: true\n---\ncorpo`)).toEqual({
      kind: "boolean",
      value: true,
    });
    expect(readDisableModelInvocation(`---\n${FIELD}: false\n---\ncorpo`)).toEqual({
      kind: "boolean",
      value: false,
    });
  });

  it("trata ausência como indefinido", () => {
    expect(readDisableModelInvocation("---\nname: demo\n---\ncorpo")).toEqual({ kind: "absent" });
  });

  it("lê chave entre aspas", () => {
    expect(readDisableModelInvocation(`---\n"${FIELD}": true\nname: demo\n---\ncorpo`)).toEqual({
      kind: "boolean",
      value: true,
    });
  });

  it("lê frontmatter em flow", () => {
    const content = `---\n{name: demo, description: desc, ${FIELD}: true}\n---\ncorpo`;
    expect(readDisableModelInvocation(content)).toEqual({ kind: "boolean", value: true });
  });

  it("lê valor com comentário inline", () => {
    expect(readDisableModelInvocation(`---\n${FIELD}: true # comentario\n---\ncorpo`)).toEqual({
      kind: "boolean",
      value: true,
    });
  });

  it("aceita TRUE, True, FALSE e False", () => {
    expect(readDisableModelInvocation(`---\n${FIELD}: TRUE\n---\n`)).toEqual({
      kind: "boolean",
      value: true,
    });
    expect(readDisableModelInvocation(`---\n${FIELD}: True\n---\n`)).toEqual({
      kind: "boolean",
      value: true,
    });
    expect(readDisableModelInvocation(`---\n${FIELD}: FALSE\n---\n`)).toEqual({
      kind: "boolean",
      value: false,
    });
    expect(readDisableModelInvocation(`---\n${FIELD}: False\n---\n`)).toEqual({
      kind: "boolean",
      value: false,
    });
  });

  it("marca valores não booleanos como inválidos", () => {
    expect(readDisableModelInvocation(`---\n${FIELD}: "true"\n---\n`)).toEqual({ kind: "invalid" });
    expect(readDisableModelInvocation(`---\n${FIELD}: 1\n---\n`)).toEqual({ kind: "invalid" });
    expect(readDisableModelInvocation(`---\n${FIELD}: null\n---\n`)).toEqual({ kind: "invalid" });
  });

  it("marca YAML inválido e ausência de frontmatter como inválidos", () => {
    expect(readDisableModelInvocation(`---\n${FIELD}: [\n---\n`)).toEqual({ kind: "invalid" });
    expect(readDisableModelInvocation("sem frontmatter")).toEqual({ kind: "invalid" });
  });
});

describe("writeDisableModelInvocation", () => {
  const base = "---\nname: demo\ndescription: desc\n---\ncorpo\n";

  it("faz round-trip de true e false", () => {
    const enabled = writeDisableModelInvocation(base, true);
    expect(readDisableModelInvocation(enabled)).toEqual({ kind: "boolean", value: true });

    const disabled = writeDisableModelInvocation(base, false);
    expect(readDisableModelInvocation(disabled)).toEqual({ kind: "boolean", value: false });
  });

  it("preserva ausência sem alterar o conteúdo", () => {
    expect(writeDisableModelInvocation(base, undefined)).toBe(base);
  });

  it("remove o campo ao voltar para indefinido", () => {
    const enabled = writeDisableModelInvocation(base, true);
    const removed = writeDisableModelInvocation(enabled, undefined);
    expect(removed).not.toContain(FIELD);
    expect(readDisableModelInvocation(removed)).toEqual({ kind: "absent" });
  });

  it("substitui o valor existente", () => {
    const enabled = writeDisableModelInvocation(base, true);
    const replaced = writeDisableModelInvocation(enabled, false);
    expect(replaced).toContain(`${FIELD}: false`);
    expect(readDisableModelInvocation(replaced)).toEqual({ kind: "boolean", value: false });
  });

  it("atualiza chave entre aspas sem duplicar", () => {
    const content = `---\n"${FIELD}": true\nname: demo\ndescription: desc\n---\ncorpo\n`;
    const written = writeDisableModelInvocation(content, false);
    expect(occurrences(written)).toBe(1);
    expect(readDisableModelInvocation(written)).toEqual({ kind: "boolean", value: false });
    expect(
      openCodeAdapter
        .parse(written, "skill")
        .diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    ).toBe(false);
  });

  it("atualiza frontmatter em flow sem duplicar", () => {
    const content = `---\n{name: demo, description: desc, ${FIELD}: true}\n---\ncorpo\n`;
    const written = writeDisableModelInvocation(content, false);
    expect(occurrences(written)).toBe(1);
    expect(readDisableModelInvocation(written)).toEqual({ kind: "boolean", value: false });
    expect(
      openCodeAdapter
        .parse(written, "skill")
        .diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    ).toBe(false);
  });

  it("preserva comentário inline ao trocar o valor", () => {
    const content = `---\n${FIELD}: true # manter\n---\ncorpo\n`;
    const written = writeDisableModelInvocation(content, false);
    expect(written).toContain(`${FIELD}: false # manter`);
    expect(readDisableModelInvocation(written)).toEqual({ kind: "boolean", value: false });
  });

  it("preserva o corpo e demais campos ao inserir o campo", () => {
    const content = "---\nname: demo\ndescription: desc\n---\ncorpo\nlinha\n";
    const written = writeDisableModelInvocation(content, true);
    expect(written.startsWith("---\nname: demo\ndescription: desc\n")).toBe(true);
    expect(written.endsWith("---\ncorpo\nlinha\n")).toBe(true);
    expect(written).toContain(`${FIELD}: true`);
  });

  it("preserva CRLF no frontmatter e no corpo", () => {
    const content =
      "---\r\nname: demo\r\ndescription: desc\r\n---\r\ncorpo\r\nlinha2\r\n";
    const written = writeDisableModelInvocation(content, true);
    expect(written).toContain(`${FIELD}: true`);
    expect(written.endsWith("---\r\ncorpo\r\nlinha2\r\n")).toBe(true);
    expect(written.replace(/\r\n/g, "")).not.toContain("\n");
    expect(readDisableModelInvocation(written)).toEqual({ kind: "boolean", value: true });
  });

  it("não altera YAML inválido nem conteúdo sem frontmatter", () => {
    const broken = `---\n${FIELD}: [\n---\ncorpo\n`;
    expect(writeDisableModelInvocation(broken, true)).toBe(broken);
    const noFrontmatter = "corpo sem frontmatter\n";
    expect(writeDisableModelInvocation(noFrontmatter, true)).toBe(noFrontmatter);
  });
});

describe("disable-model-invocation — herança YAML e anchors", () => {
  const mergeInherited =
    "---\nname: demo\ndescription: desc\ndefaults: &defaults\n  disable-model-invocation: true\n<<: *defaults\n---\ncorpo\n";

  const mergeOverride =
    "---\nname: demo\ndescription: desc\ndefaults: &defaults\n  disable-model-invocation: true\n<<: *defaults\ndisable-model-invocation: false\n---\ncorpo\n";

  const anchoredAliased =
    "---\nname: demo\ndescription: desc\ndisable-model-invocation: &flag true\nother: *flag\n---\ncorpo\n";

  it("bloqueia leitura herdada por merge e mostra valor efetivo", () => {
    expect(readDisableModelInvocation(mergeInherited)).toEqual({
      kind: "locked",
      value: true,
      reason: "merge",
    });
  });

  it("bloqueia override explícito sobre merge e mostra valor efetivo", () => {
    expect(readDisableModelInvocation(mergeOverride)).toEqual({
      kind: "locked",
      value: false,
      reason: "merge",
    });
  });

  it("não altera RAW com merge herdado", () => {
    expect(writeDisableModelInvocation(mergeInherited, true)).toBe(mergeInherited);
    expect(writeDisableModelInvocation(mergeInherited, false)).toBe(mergeInherited);
    expect(writeDisableModelInvocation(mergeInherited, undefined)).toBe(mergeInherited);
  });

  it("não altera RAW com override sobre merge", () => {
    expect(writeDisableModelInvocation(mergeOverride, true)).toBe(mergeOverride);
    expect(writeDisableModelInvocation(mergeOverride, undefined)).toBe(mergeOverride);
  });

  const nestedMerge =
    "---\nname: demo\ndescription: desc\ndefaults: &defaults\n  disable-model-invocation: true\nbase: &base\n  <<: *defaults\n<<: *base\ndisable-model-invocation: false\n---\ncorpo\n";

  it("bloqueia merge aninhado com override e mostra valor efetivo", () => {
    expect(readDisableModelInvocation(nestedMerge)).toEqual({
      kind: "locked",
      value: false,
      reason: "merge",
    });
  });

  it("não altera RAW com merge aninhado ao escolher undefined ou true", () => {
    expect(writeDisableModelInvocation(nestedMerge, undefined)).toBe(nestedMerge);
    expect(writeDisableModelInvocation(nestedMerge, true)).toBe(nestedMerge);
  });

  it("bloqueia scalar ancorado referenciado por alias", () => {
    expect(readDisableModelInvocation(anchoredAliased)).toEqual({
      kind: "locked",
      value: true,
      reason: "anchor",
    });
    expect(writeDisableModelInvocation(anchoredAliased, false)).toBe(anchoredAliased);
    expect(writeDisableModelInvocation(anchoredAliased, undefined)).toBe(anchoredAliased);
  });

  it("permite editar scalar ancorado sem aliases e preserva demais campos", () => {
    const content =
      "---\nname: demo\ndescription: desc\ndisable-model-invocation: &flag true\n---\ncorpo\n";
    expect(readDisableModelInvocation(content)).toEqual({ kind: "boolean", value: true });
    const written = writeDisableModelInvocation(content, false);
    expect(written).toContain("disable-model-invocation: &flag false");
    expect(written).toContain("name: demo");
    expect(written).toContain("description: desc");
    expect(written.endsWith("---\ncorpo\n")).toBe(true);
    expect(readDisableModelInvocation(written)).toEqual({ kind: "boolean", value: false });
  });
});

describe("disable-model-invocation — reconhecimento pelo adapter", () => {
  it("não emite unknown_fields_preserved em nenhuma forma", () => {
    const forms = [
      `---\nname: demo\ndescription: desc\n${FIELD}: true\n---\n`,
      `---\n"${FIELD}": false\nname: demo\ndescription: desc\n---\n`,
      `---\n{name: demo, description: desc, ${FIELD}: true}\n---\n`,
      `---\n${FIELD}: true # comentario\nname: demo\ndescription: desc\n---\n`,
    ];
    for (const content of forms) {
      const parsed = openCodeAdapter.parse(content, "skill");
      expect(parsed.diagnostics.some((d) => d.code === "unknown_fields_preserved")).toBe(false);
    }
  });
});
