import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, open, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, parse, resolve } from "node:path";
import { resolveDefaultBackupRoot } from "../infrastructure/fs/backup";
import { assertSafeTarget } from "../infrastructure/fs/security";
import { resolveGlobalRoot } from "../infrastructure/session";
import { openBrowser } from "./open";

export interface StartOptions {
  readonly port?: number;
  readonly open: boolean;
  readonly globalConfigDir?: string;
  readonly backupDir?: string;
  readonly sessionFile?: string;
}

const DEFAULT_PORT = 4173;

export interface HandoffPayload {
  readonly origin: string;
  readonly url: string;
  readonly token: string;
  readonly createdAt: string;
}

function resolveInstallDir(): string {
  return resolve(__dirname, "..");
}

function resolvePort(value: number | undefined): number {
  const port = value ?? DEFAULT_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Porta inválida: ${value}. Use um inteiro entre 1 e 65535.`);
  }
  return port;
}

function assertPortFree(port: number): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const tester = createServer();
    tester.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        reject(new Error(`A porta ${port} já está em uso. Escolha outra com --port.`));
        return;
      }
      reject(error);
    });
    tester.once("listening", () => {
      tester.close(() => resolvePromise());
    });
    tester.listen(port, "127.0.0.1");
  });
}

async function waitForReady(port: number, token: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  const url = `http://127.0.0.1:${port}/api/session`;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { headers: { "x-blipo-token": token } });
      if (response.status === 200) {
        return;
      }
    } catch {
      // servidor ainda não subiu
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 300));
  }

  throw new Error("O servidor não ficou pronto a tempo. Verifique os logs.");
}

export async function removeSessionFileIfOwned(target: string, token: string): Promise<void> {
  const resolved = resolve(target);
  try {
    const raw = await readFile(resolved, "utf8");
    const parsed = JSON.parse(raw) as { token?: string };
    if (parsed.token !== token) {
      return;
    }
    await rm(resolved, { force: true });
  } catch {
    // arquivo ausente ou ilegível: nada a remover
  }
}

export function createOwnedCleanup(
  target: string | undefined,
  token: string,
): () => Promise<void> {
  let cleanupPromise: Promise<void> | undefined;
  return () => {
    if (!cleanupPromise) {
      cleanupPromise = target
        ? removeSessionFileIfOwned(target, token).catch(() => undefined)
        : Promise.resolve();
    }
    return cleanupPromise;
  };
}

export async function writeSessionFile(target: string, payload: HandoffPayload): Promise<void> {
  const resolved = resolve(target);
  const root = parse(resolved).root;

  await assertSafeTarget(root, resolved);
  await mkdir(dirname(resolved), { recursive: true });
  await assertSafeTarget(root, resolved);

  let handle;
  try {
    handle = await open(resolved, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`O arquivo de sessão já existe; recusando sobrescrever: ${resolved}`);
    }
    throw error;
  }

  try {
    await handle.writeFile(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(resolved, { force: true }).catch(() => undefined);
    throw error;
  }

  await handle.close();
}

export async function runStart(options: StartOptions): Promise<void> {
  const installDir = resolveInstallDir();
  const serverJs = join(installDir, ".next", "standalone", "server.js");

  if (!existsSync(serverJs)) {
    throw new Error(
      "Build de produção não encontrado. Execute `npm run build` antes de `blipo start`.",
    );
  }

  const port = resolvePort(options.port);
  const workspace = process.cwd();
  const globalRoot = options.globalConfigDir
    ? resolve(options.globalConfigDir)
    : resolveGlobalRoot(process.env);
  const backupRoot = options.backupDir
    ? resolve(options.backupDir)
    : resolveDefaultBackupRoot(process.env);

  await assertPortFree(port);

  const token = randomBytes(32).toString("hex");
  const origin = `http://127.0.0.1:${port}`;
  const bootstrapUrl = `${origin}/#token=${token}`;

  let ownedSessionFile: string | undefined;
  if (options.sessionFile) {
    const resolvedSessionFile = resolve(options.sessionFile);
    await writeSessionFile(resolvedSessionFile, {
      origin,
      url: bootstrapUrl,
      token,
      createdAt: new Date().toISOString(),
    });
    ownedSessionFile = resolvedSessionFile;
  }

  const child = spawn(process.execPath, [serverJs], {
    cwd: dirname(serverJs),
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      BLIPO_SESSION_TOKEN: token,
      BLIPO_WORKSPACE: workspace,
      BLIPO_GLOBAL_ROOT: globalRoot,
      BLIPO_BACKUP_ROOT: backupRoot,
      BLIPO_PORT: String(port),
      BLIPO_ORIGIN: origin,
    },
    stdio: ["ignore", "inherit", "inherit"],
  });

  const cleanup = createOwnedCleanup(ownedSessionFile, token);

  const shutdown = async () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
    await cleanup();
  };

  process.once("SIGINT", () => {
    void shutdown();
  });
  process.once("SIGTERM", () => {
    void shutdown();
  });
  child.once("error", () => {
    void cleanup().finally(() => process.exit(1));
  });
  child.once("exit", (code) => {
    void cleanup().finally(() => process.exit(code ?? 0));
  });

  try {
    await waitForReady(port, token);

    console.log(`Blipo Studio: ${origin} (workspace: ${workspace})`);

    if (ownedSessionFile) {
      console.log(
        `Handoff de sessão criado em ${ownedSessionFile} (contém token; trate como dado sensível).`,
      );
    }

    if (options.open) {
      try {
        await openBrowser(bootstrapUrl);
      } catch {
        console.log("Não foi possível abrir o navegador automaticamente.");
      }
    } else if (!ownedSessionFile) {
      console.log(
        "Modo headless (--no-open): o navegador não será aberto e o token não é impresso.",
      );
      console.log("Para handoff seguro, reinicie com --session-file <caminho>.");
    }
  } catch (error) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
    await cleanup();
    throw error;
  }
}
