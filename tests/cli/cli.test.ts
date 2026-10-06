import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createOwnedCleanup, removeSessionFileIfOwned, writeSessionFile } from "@/cli/start";
import { resolveDefaultBackupRoot } from "@/infrastructure/fs/backup";
import { resolveGlobalRoot } from "@/infrastructure/session";

const execFileAsync = promisify(execFile);

describe("resolveDefaultBackupRoot", () => {
  it("usa LOCALAPPDATA no Windows", () => {
    const result = resolveDefaultBackupRoot(
      { LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local" },
      "win32",
      "C:\\Users\\u",
    );
    expect(result).toContain("blipo-studio");
    expect(result).toContain("AppData");
  });

  it("usa XDG_DATA_HOME quando definido", () => {
    const result = resolveDefaultBackupRoot({ XDG_DATA_HOME: "/data" }, "linux", "/home/u");
    expect(result).toBe(join("/data", "blipo-studio", "backups"));
  });

  it("cai no diretório local do usuário", () => {
    const result = resolveDefaultBackupRoot({}, "linux", "/home/u");
    expect(result).toBe(join("/home/u", ".local", "share", "blipo-studio", "backups"));
  });
});

describe("resolveGlobalRoot", () => {
  it("respeita OPENCODE_CONFIG_DIR", () => {
    expect(resolveGlobalRoot({ OPENCODE_CONFIG_DIR: "/custom/dir" }, "/home/u")).toContain("custom");
  });

  it("usa o padrão ~/.config/opencode", () => {
    expect(resolveGlobalRoot({}, "/home/u")).toBe(join("/home/u", ".config", "opencode"));
  });
});

describe("writeSessionFile", () => {
  it("cria arquivo exclusivo com token e origem", async () => {
    const dir = await mkdtemp(join(tmpdir(), "blipo-session-"));
    const file = join(dir, "session.json");
    try {
      await writeSessionFile(file, {
        origin: "http://127.0.0.1:1",
        url: "http://127.0.0.1:1/#token=t",
        token: "t",
        createdAt: "2026-01-01T00:00:00.000Z",
      });
      const parsed = JSON.parse(await readFile(file, "utf8"));
      expect(parsed.token).toBe("t");
      expect(parsed.origin).toBe("http://127.0.0.1:1");
      expect(parsed.url).toContain("#token=t");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("recusa sobrescrever um arquivo de sessão existente", async () => {
    const dir = await mkdtemp(join(tmpdir(), "blipo-session-"));
    const file = join(dir, "session.json");
    const payload = {
      origin: "http://127.0.0.1:1",
      url: "http://127.0.0.1:1/#token=t",
      token: "t",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    try {
      await writeSessionFile(file, payload);
      await expect(writeSessionFile(file, payload)).rejects.toThrow(/já existe/i);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

const payloadFor = (tokenValue: string) => ({
  origin: "http://127.0.0.1:1",
  url: `http://127.0.0.1:1/#token=${tokenValue}`,
  token: tokenValue,
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("handoff de sessão — limpeza e falhas", () => {
  it("remove o handoff que possui", async () => {
    const dir = await mkdtemp(join(tmpdir(), "blipo-session-"));
    const file = join(dir, "session.json");
    try {
      await writeSessionFile(file, payloadFor("mine"));
      await removeSessionFileIfOwned(file, "mine");
      expect(existsSync(file)).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("preserva handoff substituído por outro processo", async () => {
    const dir = await mkdtemp(join(tmpdir(), "blipo-session-"));
    const file = join(dir, "session.json");
    try {
      await writeSessionFile(file, payloadFor("mine"));
      await rm(file, { force: true });
      await writeFile(file, JSON.stringify(payloadFor("other")), "utf8");

      await removeSessionFileIfOwned(file, "mine");
      expect(existsSync(file)).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("limpa arquivo parcial quando a escrita falha", async () => {
    const dir = await mkdtemp(join(tmpdir(), "blipo-session-"));
    const file = join(dir, "session.json");
    try {
      const broken = { ...payloadFor("mine"), token: BigInt(1) as unknown as string };
      await expect(writeSessionFile(file, broken)).rejects.toThrow();
      expect(existsSync(file)).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("compartilha a mesma promise de remoção em chamadas concorrentes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "blipo-session-"));
    const file = join(dir, "session.json");
    try {
      await writeSessionFile(file, payloadFor("mine"));
      const cleanup = createOwnedCleanup(file, "mine");
      const first = cleanup();
      const second = cleanup();

      expect(first).toBe(second);
      await Promise.all([first, second]);
      expect(existsSync(file)).toBe(false);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("cleanup sem arquivo resolve sem erro", async () => {
    const cleanup = createOwnedCleanup(undefined, "t");
    await expect(cleanup()).resolves.toBeUndefined();
  });
});

const cliPath = join(process.cwd(), "dist", "cli.js");
const hasBuild = existsSync(cliPath);

describe.skipIf(!hasBuild)("CLI construída", () => {
  it("expõe o comando start no --help", async () => {
    const { stdout } = await execFileAsync(process.execPath, [cliPath, "--help"], {
      cwd: process.cwd(),
    });
    expect(stdout).toContain("start");
    expect(stdout).toContain("blipo");
  });

  it(
    "empacota apenas os arquivos necessários",
    async () => {
      const packArgs = ["pack", "--dry-run", "--json"];
      const { stdout } = await (process.platform === "win32"
        ? execFileAsync("cmd", ["/c", "npm", ...packArgs], {
            cwd: process.cwd(),
            maxBuffer: 256 * 1024 * 1024,
          })
        : execFileAsync("npm", packArgs, {
            cwd: process.cwd(),
            maxBuffer: 256 * 1024 * 1024,
          }));
      const packs = JSON.parse(stdout);
      const files = packs[0].files.map((file: { path: string }) => file.path);
      expect(files).toContain("dist/cli.js");
      expect(files.some((path: string) => path.startsWith("src/"))).toBe(false);
      expect(files.some((path: string) => path.startsWith("tests/"))).toBe(false);
    },
    120_000,
  );
});
