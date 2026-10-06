import { createResource, deleteResource, updateResource } from "@/core/application";
import { assertAuthorized } from "@/app/api/_lib/auth";
import { createFileStore, requireAdapter, requireSession } from "@/app/api/_lib/context";
import { handleRoute, jsonResponse, readJsonBodyLimited } from "@/app/api/_lib/http";
import { mutateRequestSchema, parseOrThrow } from "@/app/api/_lib/schemas";

export const runtime = "nodejs";

export const POST = handleRoute(async (request) => {
  const session = requireSession();
  assertAuthorized(request, session, true);

  const body = parseOrThrow(mutateRequestSchema, await readJsonBodyLimited(request));
  const adapter = requireAdapter(body.provider);
  const fileStore = createFileStore(session);

  if (body.action === "create") {
    const report = await createResource({
      adapter,
      fileStore,
      scope: body.scope,
      kind: body.kind,
      name: body.name,
      content: body.content,
    });
    return jsonResponse({ action: body.action, report });
  }

  if (body.action === "update") {
    const report = await updateResource({
      adapter,
      fileStore,
      scope: body.scope,
      kind: body.kind,
      name: body.name,
      content: body.content,
      expectedVersion: body.expectedVersion,
    });
    return jsonResponse({ action: body.action, report });
  }

  const report = await deleteResource({
    adapter,
    fileStore,
    scope: body.scope,
    kind: body.kind,
    name: body.name,
    expectedVersion: body.expectedVersion,
  });
  return jsonResponse({ action: body.action, report });
});
