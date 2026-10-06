import { randomBytes } from "node:crypto";
import { chmod, copyFile, lstat, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import { StudioError, type Scope, type StorageKind } from "@/core/domain";
import type { BackupRef } from "@/core/ports";
import { assertSafeTarget } from "./security";

export interface BackupRequest {
  readonly backupRoot: string;
  readonly sourcePath: string;
  readonly relativePath: string;
  readonly scope: Scope;
  readonly storage: StorageKind;
  readonly name: string;
  readonly version: string;
  readonly operation: "update" | "delete";
}

export function resolveDefaultBackupRoot(
  env: Record<string, string | undefined> = process.env,
  platform: NodeJS.Platform = process.platform,
  home: string = homedir(),
): string {
  if (platform === "win32" && env.LOCALAPPDATA) {
    return join(env.LOCALAPPDATA, "blipo-studio", "backups");
  }
  if (env.XDG_DATA_HOME) {
    return join(env.XDG_DATA_HOME, "blipo-studio", "backups");
  }
  return join(home, ".local", "share", "blipo-studio", "backups");
}

export async function createBackup(request: BackupRequest): Promise<BackupRef> {
  const createdAt = new Date().toISOString();
  const stamp = createdAt.replace(/[:.]/g, "-");
  const hashPart = request.version.slice(0, 8);
  const randomPart = randomBytes(4).toString("hex");
  const id = `${stamp}-${hashPart}-${randomPart}`;
  const directory = join(request.backupRoot, id);
  const storedName = basename(request.relativePath);
  const storedPath = join(directory, storedName);

  try {
    await assertSafeTarget(request.backupRoot, directory);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await assertSafeTarget(request.backupRoot, directory);
    await assertSafeTarget(request.backupRoot, storedPath);

    const sourceStats = await lstat(request.sourcePath);
    if (!sourceStats.isFile()) {
      throw new StudioError("backup_failed", "A origem do backup não é um arquivo regular.");
    }

    await copyFile(request.sourcePath, storedPath);
    await chmod(storedPath, 0o600);

    const manifest = {
      id,
      operation: request.operation,
      scope: request.scope,
      storage: request.storage,
      name: request.name,
      sourcePath: request.sourcePath,
      backupPath: storedPath,
      version: request.version,
      createdAt,
      note: "Backup obrigatório e sem expiração.",
    };
    await writeFile(join(directory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, {
      mode: 0o600,
    });
  } catch (error) {
    if (error instanceof StudioError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new StudioError("backup_failed", `Falha ao criar backup: ${message}`);
  }

  return { id, path: directory, createdAt };
}
