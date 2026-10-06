import {
  OPERATIONS,
  RESOURCE_KINDS,
  SCOPES,
  errorDiagnostic,
  hasError,
  storageKind,
  type AgentMode,
  type Capability,
  type Diagnostic,
  type ResourceKind,
} from "@/core/domain";
import type {
  FileChangePlan,
  ParsedFrontmatter,
  ProviderAdapter,
  ResourceChangeRequest,
  ValidationInput,
  ValidationResult,
} from "@/core/ports";
import { modeLabel, parseDocument, validateResourceName } from "./frontmatter";

const AGENT_KNOWN_FIELDS = [
  "description",
  "mode",
  "model",
  "temperature",
  "steps",
  "maxSteps",
  "disable",
  "prompt",
  "tools",
  "permission",
  "hidden",
  "color",
  "top_p",
  "topP",
  "reasoningEffort",
  "textVerbosity",
];

const SKILL_KNOWN_FIELDS = [
  "name",
  "description",
  "license",
  "compatibility",
  "metadata",
  "disable-model-invocation",
];

function buildCapabilities(): readonly Capability[] {
  const capabilities: Capability[] = [];
  for (const resourceKind of RESOURCE_KINDS) {
    for (const scope of SCOPES) {
      for (const operation of OPERATIONS) {
        capabilities.push({ resourceKind, scope, operation, status: "verified" });
      }
    }
  }
  return capabilities;
}

const CAPABILITIES = buildCapabilities();

function unknownFieldWarning(data: Record<string, unknown>, kind: ResourceKind): Diagnostic[] {
  const known = kind === "skill" ? SKILL_KNOWN_FIELDS : AGENT_KNOWN_FIELDS;
  const unknown = Object.keys(data).filter((key) => !known.includes(key));
  if (unknown.length === 0) {
    return [];
  }
  return [
    {
      severity: "warning",
      code: "unknown_fields_preserved",
      message: `Campos desconhecidos serão preservados sem alteração: ${unknown.join(", ")}.`,
    },
  ];
}

function parse(content: string, kind: ResourceKind): ParsedFrontmatter {
  const parsed = parseDocument(content, kind);
  return {
    diagnostics: [
      ...parsed.diagnostics,
      ...(parsed.data ? unknownFieldWarning(parsed.data, kind) : []),
    ],
    data: parsed.data,
    mode: parsed.mode,
    description: parsed.description,
    disableModelInvocation: parsed.disableModelInvocation,
  };
}

function validateAgentMode(kind: ResourceKind, mode: AgentMode | undefined): Diagnostic[] {
  const effective = modeLabel(mode);

  if (kind === "subagent" && effective !== "subagent") {
    return [
      errorDiagnostic(
        "mode_mismatch",
        'Um subagente deve declarar "mode: subagent" no frontmatter.',
      ),
    ];
  }

  if (kind === "agent" && effective === "subagent") {
    return [
      errorDiagnostic(
        "mode_mismatch",
        'Um agente primário não pode declarar "mode: subagent"; use "primary" ou "all".',
      ),
    ];
  }

  return [];
}

function validateSkillName(fieldName: string | undefined, directoryName: string): Diagnostic[] {
  if (fieldName === undefined) {
    return [];
  }

  if (fieldName !== directoryName) {
    return [
      errorDiagnostic(
        "skill_name_mismatch",
        `O campo "name" (${fieldName}) deve ser igual ao nome da pasta (${directoryName}).`,
      ),
    ];
  }

  const nameDiagnostic = validateResourceName(fieldName);
  return nameDiagnostic ? [nameDiagnostic] : [];
}

function validate(input: ValidationInput): ValidationResult {
  const diagnostics: Diagnostic[] = [];

  const nameDiagnostic = validateResourceName(input.name);
  if (nameDiagnostic) {
    diagnostics.push(nameDiagnostic);
  }

  const parsed = parse(input.content, input.kind);
  diagnostics.push(...parsed.diagnostics);

  if (input.kind === "skill" && parsed.data) {
    const name = typeof parsed.data.name === "string" ? parsed.data.name : undefined;
    diagnostics.push(...validateSkillName(name, input.name));
  } else if (input.kind !== "skill") {
    diagnostics.push(...validateAgentMode(input.kind, parsed.mode));
  }

  return {
    ok: !hasError(diagnostics),
    diagnostics,
    mode: parsed.mode,
    description: parsed.description,
    disableModelInvocation: parsed.disableModelInvocation,
  };
}

function planChanges(request: ResourceChangeRequest): FileChangePlan {
  const target = {
    scope: request.scope,
    storage: storageKind(request.kind),
    name: request.name,
  };

  if (request.operation === "create") {
    return {
      operations: [{ type: "create", target, content: request.content ?? "" }],
    };
  }

  if (request.operation === "update") {
    return {
      operations: [
        {
          type: "update",
          target,
          content: request.content ?? "",
          expectedVersion: request.expectedVersion ?? "",
        },
      ],
    };
  }

  if (request.operation === "delete") {
    return {
      operations: [
        { type: "delete", target, expectedVersion: request.expectedVersion ?? "" },
      ],
    };
  }

  throw new Error(`Operação não suportada pelo adapter OpenCode: ${request.operation}`);
}

export const openCodeAdapter: ProviderAdapter = {
  providerId: "opencode",
  capabilities: () => CAPABILITIES,
  parse,
  validate,
  planChanges,
};
