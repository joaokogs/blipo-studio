import type { AgentMode, ResourceKind } from "@/core/domain";

export interface TemplateInput {
  readonly kind: ResourceKind;
  readonly name: string;
  readonly description: string;
  readonly mode?: AgentMode;
}

function agentFrontmatter(mode: AgentMode | undefined): string {
  if (mode === "primary") {
    return "mode: primary\n";
  }
  if (mode === "subagent") {
    return "mode: subagent\n";
  }
  return "mode: all\n";
}

export function buildTemplate(input: TemplateInput): string {
  if (input.kind === "skill") {
    return [
      "---",
      `name: ${input.name}`,
      `description: ${input.description}`,
      "---",
      "",
      `Descreva aqui o que a skill ${input.name} faz e quando deve ser usada.`,
      "",
    ].join("\n");
  }

  const mode =
    input.kind === "subagent" ? input.mode ?? "subagent" : input.mode ?? "primary";
  return [
    "---",
    `description: ${input.description}`,
    agentFrontmatter(mode).trimEnd(),
    "---",
    "",
    `Você é o agente ${input.name}. Descreva aqui suas instruções.`,
    "",
  ].join("\n");
}
