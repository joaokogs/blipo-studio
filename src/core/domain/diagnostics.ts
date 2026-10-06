export type DiagnosticSeverity = "error" | "warning";

export interface Diagnostic {
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export function errorDiagnostic(code: string, message: string, path?: string): Diagnostic {
  return { severity: "error", code, message, path };
}

export function warningDiagnostic(code: string, message: string, path?: string): Diagnostic {
  return { severity: "warning", code, message, path };
}

export function hasError(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((diagnostic) => diagnostic.severity === "error");
}
