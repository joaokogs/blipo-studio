import { StudioError } from "@/core/domain";

export const MAX_BODY_BYTES = 1024 * 1024;

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(`${JSON.stringify(data)}\n`, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof StudioError) {
    return jsonResponse({ error: { code: error.code, message: error.message } }, error.status);
  }
  return jsonResponse(
    { error: { code: "internal", message: "Erro interno do servidor." } },
    500,
  );
}

export function handleRoute(
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request: Request) => {
    try {
      return await handler(request);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function readJsonBodyLimited(
  request: Request,
  limit: number = MAX_BODY_BYTES,
): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > limit) {
    throw new StudioError("payload_too_large", `Corpo da requisição excede ${limit} bytes.`);
  }

  if (!request.body) {
    return null;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel().catch(() => undefined);
      throw new StudioError("payload_too_large", `Corpo da requisição excede ${limit} bytes.`);
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder().decode(merged);
  if (text.trim().length === 0) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new StudioError("validation_error", "JSON inválido no corpo da requisição.");
  }
}
