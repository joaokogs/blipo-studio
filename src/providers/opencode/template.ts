import type { AgentMode, ResourceKind } from "@/core/domain";

export interface TemplateInput {
  readonly kind: ResourceKind;
  readonly name: string;
  readonly description: string;
  readonly mode?: AgentMode;
  readonly disableModelInvocation?: boolean;
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
    const frontmatter = ["---", `name: ${input.name}`, `description: ${input.description}`];
    if (input.disableModelInvocation !== undefined) {
      frontmatter.push(
        `disable-model-invocation: ${input.disableModelInvocation ? "true" : "false"}`,
      );
    }
    frontmatter.push("---", "", `Descreva aqui o que a skill ${input.name} faz e quando deve ser usada.`, "");
    return frontmatter.join("\n");
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
