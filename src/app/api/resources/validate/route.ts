import { validateResource } from "@/core/application";
import { assertAuthorized } from "@/app/api/_lib/auth";
import { requireAdapter, requireSession } from "@/app/api/_lib/context";
import { handleRoute, jsonResponse, readJsonBodyLimited } from "@/app/api/_lib/http";
import { parseOrThrow, validateRequestSchema } from "@/app/api/_lib/schemas";

export const runtime = "nodejs";

export const POST = handleRoute(async (request) => {
  const session = requireSession();
  assertAuthorized(request, session, false);

  const body = parseOrThrow(validateRequestSchema, await readJsonBodyLimited(request));
  const adapter = requireAdapter(body.provider);

  const result = validateResource({
    adapter,
    scope: body.scope,
    kind: body.kind,
    name: body.name,
    content: body.content,
  });

  return jsonResponse(result);
});
