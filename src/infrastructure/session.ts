import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { resolveDefaultBackupRoot } from "./fs/backup";

export interface StudioSession {
  readonly token: string;
  readonly workspace: string;
  readonly globalRoot: string;
  readonly backupRoot: string;
  readonly port: number;
  readonly origin: string;
}

export const SESSION_ENV = {
  token: "BLIPO_SESSION_TOKEN",
  workspace: "BLIPO_WORKSPACE",
  globalRoot: "BLIPO_GLOBAL_ROOT",
  backupRoot: "BLIPO_BACKUP_ROOT",
  port: "BLIPO_PORT",
  origin: "BLIPO_ORIGIN",
} as const;

export function resolveGlobalRoot(
  env: Record<string, string | undefined> = process.env,
  home: string = homedir(),
): string {
  const custom = env.OPENCODE_CONFIG_DIR;
  if (custom && custom.trim().length > 0) {
    return resolve(custom);
  }
  return join(home, ".config", "opencode");
}

export function readSessionFromEnv(
  env: Record<string, string | undefined> = process.env,
): StudioSession | null {
  const token = env[SESSION_ENV.token];
  const workspace = env[SESSION_ENV.workspace];
  const origin = env[SESSION_ENV.origin];
  const port = env[SESSION_ENV.port] ? Number(env[SESSION_ENV.port]) : Number.NaN;

  if (!token || !workspace || !origin || !Number.isInteger(port)) {
    return null;
  }

  const globalRoot = env[SESSION_ENV.globalRoot] ?? resolveGlobalRoot(env);
  const backupRoot = env[SESSION_ENV.backupRoot] ?? resolveDefaultBackupRoot(env);

  return { token, workspace: resolve(workspace), globalRoot, backupRoot, port, origin };
}
