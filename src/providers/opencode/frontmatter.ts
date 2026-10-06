import { parse as parseYaml } from "yaml";
import {
  AGENT_MODES,
  SKILL_DESCRIPTION_MAX_LENGTH,
  describeInvalidResourceName,
  errorDiagnostic,
  isValidResourceName,
  warningDiagnostic,
  type AgentMode,
  type Diagnostic,
  type ResourceKind,
} from "@/core/domain";

export interface FrontmatterSplit {
  readonly present: boolean;
  readonly closed: boolean;
  readonly yaml: string;
  readonly body: string;
}

export interface ParsedDocument {
  readonly diagnostics: readonly Diagnostic[];
  readonly data?: Record<string, unknown>;
  readonly mode?: AgentMode;
  readonly description?: string;
  readonly disableModelInvocation?: boolean;
}

const OPENING = /^---[ \t]*\r?$/;
const CLOSING = /^---[ \t]*\r?$/;

export function splitFrontmatter(content: string): FrontmatterSplit {
  const lines = content.split(/\r?\n/);

  if (lines.length === 0 || !OPENING.test(lines[0] ?? "")) {
    return { present: false, closed: false, yaml: "", body: content };
  }

  for (let index = 1; index < lines.length; index += 1) {
    if (CLOSING.test(lines[index] ?? "")) {
      return {
        present: true,
        closed: true,
        yaml: lines.slice(1, index).join("\n"),
        body: lines.slice(index + 1).join("\n"),
      };
    }
  }

  return { present: true, closed: false, yaml: lines.slice(1).join("\n"), body: "" };
}

function isPlainMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeYamlError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/\n+/g, " ").trim();
  }
  return "YAML inválido.";
}

export type FrontmatterYamlResult =
  | { readonly ok: true; readonly data: Record<string, unknown> }
  | {
      readonly ok: false;
      readonly reason: "empty" | "syntax" | "mapping";
      readonly message?: string;
    };

export function parseFrontmatterYaml(yaml: string): FrontmatterYamlResult {
  if (yaml.trim().length === 0) {
    return { ok: false, reason: "empty" };
  }

  let data: unknown;
  try {
    data = parseYaml(yaml, { merge: true, uniqueKeys: true });
  } catch (error) {
    return { ok: false, reason: "syntax", message: describeYamlError(error) };
  }

  if (!isPlainMapping(data)) {
    return { ok: false, reason: "mapping" };
  }

  return { ok: true, data };
}

function parseMapping(yaml: string): { data?: Record<string, unknown>; diagnostics: Diagnostic[] } {
  const result = parseFrontmatterYaml(yaml);
  if (result.ok) {
    return { data: result.data, diagnostics: [] };
  }

  if (result.reason === "empty") {
    return {
      diagnostics: [errorDiagnostic("frontmatter_empty", "O frontmatter está vazio.")],
    };
  }

  if (result.reason === "syntax") {
    return { diagnostics: [errorDiagnostic("yaml_syntax", `YAML inválido: ${result.message}`)] };
  }

  return {
    diagnostics: [errorDiagnostic("yaml_mapping", "O frontmatter deve ser um mapeamento YAML.")],
  };
}

function checkAgentFieldTypes(data: Record<string, unknown>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const stringFields = ["model"];
  for (const field of stringFields) {
    if (field in data && data[field] !== undefined && typeof data[field] !== "string") {
      diagnostics.push(errorDiagnostic("invalid_field_type", `O campo "${field}" deve ser string.`));
    }
  }

  if ("temperature" in data && data.temperature !== undefined && typeof data.temperature !== "number") {
    diagnostics.push(errorDiagnostic("invalid_field_type", 'O campo "temperature" deve ser numérico.'));
  }

  for (const field of ["hidden", "disable"]) {
    if (field in data && data[field] !== undefined && typeof data[field] !== "boolean") {
      diagnostics.push(errorDiagnostic("invalid_field_type", `O campo "${field}" deve ser booleano.`));
    }
  }

  for (const field of ["permission", "tools"]) {
    if (field in data && data[field] !== undefined && !isPlainMapping(data[field])) {
      diagnostics.push(
        errorDiagnostic("invalid_field_type", `O campo "${field}" deve ser um mapeamento.`),
      );
    }
  }

  return diagnostics;
}

function parseMode(data: Record<string, unknown>): { mode?: AgentMode; diagnostics: Diagnostic[] } {
  if (!("mode" in data) || data.mode === undefined) {
    return { diagnostics: [] };
  }

  const mode = data.mode;
  if (typeof mode !== "string" || !AGENT_MODES.includes(mode as AgentMode)) {
    return {
      diagnostics: [
        errorDiagnostic(
          "invalid_mode",
          `O campo "mode" deve ser um de: ${AGENT_MODES.join(", ")}.`,
        ),
      ],
    };
  }

  return { mode: mode as AgentMode, diagnostics: [] };
}

function parseBooleanField(
  data: Record<string, unknown>,
  field: string,
): { value?: boolean; diagnostics: Diagnostic[] } {
  if (!(field in data) || data[field] === undefined) {
    return { diagnostics: [] };
  }

  const value = data[field];
  if (typeof value !== "boolean") {
    return {
      diagnostics: [errorDiagnostic("invalid_field_type", `O campo "${field}" deve ser booleano.`)],
    };
  }

  return { value, diagnostics: [] };
}

function parseDescription(data: Record<string, unknown>, required: boolean): { description?: string; diagnostics: Diagnostic[] } {
  if (!("description" in data) || data.description === undefined) {
    return required
      ? { diagnostics: [errorDiagnostic("missing_description", 'O campo "description" é obrigatório.')] }
      : { diagnostics: [] };
  }

  const description = data.description;
  if (typeof description !== "string" || description.trim().length === 0) {
    return {
      diagnostics: [errorDiagnostic("invalid_description", 'O campo "description" deve ser uma string não vazia.')],
    };
  }

  return { description, diagnostics: [] };
}

export function parseDocument(content: string, kind: ResourceKind): ParsedDocument {
  const split = splitFrontmatter(content);

  if (!split.present) {
    return {
      diagnostics: [
        errorDiagnostic("missing_frontmatter", "O arquivo deve começar com um frontmatter YAML delimitado por ---."),
      ],
    };
  }

  const diagnostics: Diagnostic[] = [];
  if (!split.closed) {
    diagnostics.push(errorDiagnostic("unclosed_frontmatter", "O frontmatter YAML não foi fechado com ---."));
  }

  const mapping = parseMapping(split.yaml);
  diagnostics.push(...mapping.diagnostics);

  if (!mapping.data) {
    return { diagnostics };
  }

  const data = mapping.data;
  let mode: AgentMode | undefined;
  let description: string | undefined;
  let disableModelInvocation: boolean | undefined;

  if (kind === "skill") {
    if (!("name" in data) || data.name === undefined) {
      diagnostics.push(errorDiagnostic("missing_skill_name", 'O campo "name" é obrigatório.'));
    } else if (typeof data.name !== "string") {
      diagnostics.push(errorDiagnostic("invalid_skill_name", 'O campo "name" deve ser string.'));
    }

    const descriptionResult = parseDescription(data, true);
    diagnostics.push(...descriptionResult.diagnostics);
    description = descriptionResult.description;

    const disableResult = parseBooleanField(data, "disable-model-invocation");
    diagnostics.push(...disableResult.diagnostics);
    disableModelInvocation = disableResult.value;

    if (description && description.length > SKILL_DESCRIPTION_MAX_LENGTH) {
      diagnostics.push(
        errorDiagnostic(
          "description_too_long",
          `A descrição deve ter no máximo ${SKILL_DESCRIPTION_MAX_LENGTH} caracteres.`,
        ),
      );
    }

    for (const field of ["license", "compatibility"]) {
      if (field in data && data[field] !== undefined && typeof data[field] !== "string") {
        diagnostics.push(errorDiagnostic("invalid_field_type", `O campo "${field}" deve ser string.`));
      }
    }

    if ("metadata" in data && data.metadata !== undefined) {
      const metadata = data.metadata;
      if (!isPlainMapping(metadata)) {
        diagnostics.push(errorDiagnostic("invalid_field_type", 'O campo "metadata" deve ser um mapeamento.'));
      } else if (Object.values(metadata).some((value) => typeof value !== "string")) {
        diagnostics.push(
          errorDiagnostic("invalid_field_type", 'O campo "metadata" deve mapear strings para strings.'),
        );
      }
    }
  } else {
    const modeResult = parseMode(data);
    diagnostics.push(...modeResult.diagnostics);
    mode = modeResult.mode;
    if (mode === undefined && modeResult.diagnostics.length === 0) {
      mode = "all";
    }

    const descriptionResult = parseDescription(data, true);
    diagnostics.push(...descriptionResult.diagnostics);
    description = descriptionResult.description;

    diagnostics.push(...checkAgentFieldTypes(data));
  }

  return { diagnostics, data, mode, description, disableModelInvocation };
}

export function validateResourceName(name: string): Diagnostic | null {
  const reason = describeInvalidResourceName(name);
  if (!reason) {
    return null;
  }
  if (!isValidResourceName(name)) {
    return errorDiagnostic("invalid_name", reason);
  }
  return null;
}

export function modeLabel(mode: AgentMode | undefined): string {
  if (mode === undefined) {
    return "all";
  }
  return mode;
}

export function warningAboutUnknownFields(data: Record<string, unknown>, known: readonly string[]): Diagnostic[] {
  const unknown = Object.keys(data).filter((key) => !known.includes(key));
  if (unknown.length === 0) {
    return [];
  }
  return [
    warningDiagnostic(
      "unknown_fields_preserved",
      `Campos desconhecidos serão preservados sem alteração: ${unknown.join(", ")}.`,
    ),
  ];
}
