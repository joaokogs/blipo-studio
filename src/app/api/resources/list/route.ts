import { listResources } from "@/core/application";
import { assertAuthorized } from "@/app/api/_lib/auth";
import { createFileStore, requireAdapter, requireSession } from "@/app/api/_lib/context";
import { handleRoute, jsonResponse, readJsonBodyLimited } from "@/app/api/_lib/http";
import { listRequestSchema, parseOrThrow } from "@/app/api/_lib/schemas";

export const runtime = "nodejs";

export const POST = handleRoute(async (request) => {
  const session = requireSession();
  assertAuthorized(request, session, false);

  const body = parseOrThrow(listRequestSchema, await readJsonBodyLimited(request));
  const adapter = requireAdapter(body.provider);

  const result = await listResources({
    adapter,
    fileStore: createFileStore(session),
    scope: body.scope,
  });

  return jsonResponse({
    provider: adapter.providerId,
    resources: result.resources,
    diagnostics: result.diagnostics,
  });
});
