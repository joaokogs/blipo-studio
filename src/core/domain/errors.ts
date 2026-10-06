export type StudioErrorCode =
  | "validation_error"
  | "unsupported"
  | "not_found"
  | "conflict"
  | "unsafe_path"
  | "backup_failed"
  | "payload_too_large"
  | "unauthorized"
  | "forbidden"
  | "internal";

const STATUS_BY_CODE: Record<StudioErrorCode, number> = {
  validation_error: 422,
  unsupported: 422,
  not_found: 404,
  conflict: 409,
  unsafe_path: 422,
  backup_failed: 500,
  payload_too_large: 413,
  unauthorized: 401,
  forbidden: 403,
  internal: 500,
};

export class StudioError extends Error {
  readonly code: StudioErrorCode;
  readonly status: number;

  constructor(code: StudioErrorCode, message: string) {
    super(message);
    this.name = "StudioError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export function statusForCode(code: StudioErrorCode): number {
  return STATUS_BY_CODE[code];
}
