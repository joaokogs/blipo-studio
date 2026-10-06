import { hasError, type Diagnostic } from "@/core/domain";
import type { ValidationResult } from "@/core/ports";

export function collectErrorMessages(diagnostics: readonly Diagnostic[]): string {
  return diagnostics
    .filter((diagnostic) => diagnostic.severity === "error")
    .map((diagnostic) => diagnostic.message)
    .join(" ");
}

export function firstErrorOr(result: ValidationResult, fallback: string): string {
  if (hasError(result.diagnostics)) {
    const message = collectErrorMessages(result.diagnostics);
    return message.length > 0 ? message : fallback;
  }
  return fallback;
}
