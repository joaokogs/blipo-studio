import { spawn } from "node:child_process";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const root = resolve(process.cwd());
const serverJs = join(root, ".next", "standalone", "server.js");
const port = process.env.BLIPO_E2E_PORT ?? "4599";
const token = process.env.BLIPO_E2E_TOKEN ?? "e2e".repeat(16);
const workspace = process.env.BLIPO_E2E_WORKSPACE ?? (await mkdtemp(join(tmpdir(), "blipo-e2e-")));

await mkdir(join(workspace, ".opencode"), { recursive: true });

const child = spawn(process.execPath, [serverJs], {
  cwd: dirname(serverJs),
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: port,
    BLIPO_SESSION_TOKEN: token,
    BLIPO_WORKSPACE: workspace,
    BLIPO_GLOBAL_ROOT: join(workspace, ".global-opencode"),
    BLIPO_BACKUP_ROOT: join(workspace, ".backups"),
    BLIPO_PORT: port,
    BLIPO_ORIGIN: `http://127.0.0.1:${port}`,
  },
});

function shutdown() {
  child.kill("SIGTERM");
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
child.on("exit", (code) => process.exit(code ?? 0));
