import { timingSafeEqual } from "node:crypto";
import { StudioError } from "@/core/domain";
import type { StudioSession } from "@/infrastructure/session";

export const TOKEN_HEADER = "x-blipo-token";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function assertAuthorized(
  request: Request,
  session: StudioSession,
  requireOrigin: boolean,
): void {
  const host = request.headers.get("host");
  const expectedHost = `127.0.0.1:${session.port}`;
  if (host !== expectedHost) {
    throw new StudioError("forbidden", "Host não permitido.");
  }

  const token = request.headers.get(TOKEN_HEADER);
  if (!token || !safeEqual(token, session.token)) {
    throw new StudioError("unauthorized", "Token ausente ou inválido.");
  }

  const origin = request.headers.get("origin");
  if (origin !== null) {
    if (origin !== session.origin) {
      throw new StudioError("forbidden", "Origem não permitida.");
    }
  } else if (requireOrigin) {
    throw new StudioError("forbidden", "Origin é obrigatório para operações de mutação.");
  }
}
