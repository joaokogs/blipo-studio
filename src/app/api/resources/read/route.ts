import { readResource } from "@/core/application";
import { assertAuthorized } from "@/app/api/_lib/auth";
import { createFileStore, requireAdapter, requireSession } from "@/app/api/_lib/context";
import { handleRoute, jsonResponse, readJsonBodyLimited } from "@/app/api/_lib/http";
import { parseOrThrow, readRequestSchema } from "@/app/api/_lib/schemas";

export const runtime = "nodejs";

export const POST = handleRoute(async (request) => {
  const session = requireSession();
  assertAuthorized(request, session, false);

  const body = parseOrThrow(readRequestSchema, await readJsonBodyLimited(request));
  const adapter = requireAdapter(body.provider);

  const result = await readResource({
    adapter,
    fileStore: createFileStore(session),
    scope: body.scope,
    kind: body.kind,
    name: body.name,
  });

  return jsonResponse(result);
});
