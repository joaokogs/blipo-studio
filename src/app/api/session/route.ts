import { SCOPES } from "@/core/domain";
import { providerCatalog } from "@/providers/catalog";
import packageJson from "../../../../package.json";
import { assertAuthorized } from "../_lib/auth";
import { requireSession } from "../_lib/context";
import { handleRoute, jsonResponse } from "../_lib/http";

export const runtime = "nodejs";

export const GET = handleRoute(async (request) => {
  const session = requireSession();
  assertAuthorized(request, session, false);

  const providers = providerCatalog.listProviders();
  const capabilities = providers.flatMap((provider) =>
    provider.capabilities.map((capability) => ({
      provider: provider.id,
      resourceKind: capability.resourceKind,
      scope: capability.scope,
      operation: capability.operation,
      status: capability.status,
    })),
  );

  return jsonResponse({
    version: packageJson.version,
    workspace: session.workspace,
    backupRoot: session.backupRoot,
    origin: session.origin,
    port: session.port,
    scopes: SCOPES,
    providers: providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      implementationStatus: provider.implementationStatus,
    })),
    capabilities,
  });
});
