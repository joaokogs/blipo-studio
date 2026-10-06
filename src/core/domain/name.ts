export const RESOURCE_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const RESOURCE_NAME_MIN_LENGTH = 1;
export const RESOURCE_NAME_MAX_LENGTH = 64;
export const SKILL_DESCRIPTION_MIN_LENGTH = 1;
export const SKILL_DESCRIPTION_MAX_LENGTH = 1024;

const WINDOWS_RESERVED_NAMES = new Set([
  "con",
  "prn",
  "aux",
  "nul",
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
]);

export function isValidResourceName(name: string): boolean {
  if (typeof name !== "string") {
    return false;
  }

  if (name.length < RESOURCE_NAME_MIN_LENGTH || name.length > RESOURCE_NAME_MAX_LENGTH) {
    return false;
  }

  if (!RESOURCE_NAME_PATTERN.test(name)) {
    return false;
  }

  return !WINDOWS_RESERVED_NAMES.has(name.toLowerCase());
}

export function describeInvalidResourceName(name: string): string | null {
  if (typeof name !== "string" || name.length === 0) {
    return "O nome é obrigatório.";
  }

  if (name.length > RESOURCE_NAME_MAX_LENGTH) {
    return `O nome deve ter no máximo ${RESOURCE_NAME_MAX_LENGTH} caracteres.`;
  }

  if (!RESOURCE_NAME_PATTERN.test(name)) {
    return "O nome deve usar apenas letras minúsculas, números e hífens simples (ex.: meu-agente).";
  }

  if (WINDOWS_RESERVED_NAMES.has(name.toLowerCase())) {
    return "O nome é reservado pelo sistema de arquivos do Windows.";
  }

  return null;
}
