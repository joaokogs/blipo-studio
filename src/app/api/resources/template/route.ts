import { assertAuthorized } from "@/app/api/_lib/auth";
import { requireAdapter, requireSession } from "@/app/api/_lib/context";
import { handleRoute, jsonResponse, readJsonBodyLimited } from "@/app/api/_lib/http";
import { parseOrThrow, templateRequestSchema } from "@/app/api/_lib/schemas";
import { buildTemplate } from "@/providers/opencode/template";

export const runtime = "nodejs";

export const POST = handleRoute(async (request) => {
  const session = requireSession();
  assertAuthorized(request, session, false);

  const body = parseOrThrow(templateRequestSchema, await readJsonBodyLimited(request));
  const adapter = requireAdapter(body.provider);

  const content = buildTemplate({
    kind: body.kind,
    name: body.name,
    description: body.description,
    mode: body.mode,
  });

  return jsonResponse({ provider: adapter.providerId, content });
});
