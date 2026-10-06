import { StudioError, PROVIDER_IDS, type ProviderId } from "@/core/domain";
import type { ProviderAdapter } from "@/core/ports";
import { FsFileStore } from "@/infrastructure/fs/fs-file-store";
import { readSessionFromEnv, type StudioSession } from "@/infrastructure/session";
import { getAdapter } from "@/providers/registry";

export function requireSession(): StudioSession {
  const session = readSessionFromEnv();
  if (!session) {
    throw new StudioError(
      "unauthorized",
      "Sessão ausente. Inicie o Blipo Studio pelo comando `blipo start`.",
    );
  }
  return session;
}

export function requireAdapter(providerId: string): ProviderAdapter {
  if (!PROVIDER_IDS.includes(providerId as ProviderId)) {
    throw new StudioError("validation_error", `Provider desconhecido: ${providerId}.`);
  }

  const adapter = getAdapter(providerId as ProviderId);
  if (!adapter) {
    throw new StudioError("unsupported", `O provider ${providerId} ainda não está implementado.`);
  }

  return adapter;
}

export function createFileStore(session: StudioSession): FsFileStore {
  return new FsFileStore({
    repositoryRoot: session.workspace,
    globalRoot: session.globalRoot,
    backupRoot: session.backupRoot,
  });
}
