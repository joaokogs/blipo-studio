import { createHash, randomBytes } from "node:crypto";
import { chmod, mkdir, open, opendir, readFile, rename, rm, unlink } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import {
  StudioError,
  describeInvalidResourceName,
  isValidResourceName,
  type Scope,
} from "@/core/domain";
import type {
  ApplyReport,
  FileChangePlan,
  FileContent,
  FileOperation,
  FileStore,
  ListReport,
  LogicalTarget,
  ScanIssue,
  StoredFile,
} from "@/core/ports";
import { createBackup } from "./backup";
import { withLock } from "./mutex";
import { assertSafeTarget, lstatOrNull } from "./security";

export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_LIST_FILES = 200;
export const MAX_LIST_BYTES = 16 * 1024 * 1024;
export const MAX_LIST_ENTRIES = 1000;

interface ListBudget {
  entries: number;
  files: number;
  bytes: number;
  truncated: boolean;
}

function applyTruncation(budget: ListBudget, issues: ScanIssue[], path: string): boolean {
  if (budget.truncated) {
    return true;
  }
  if (
    budget.entries > MAX_LIST_ENTRIES ||
    budget.files > MAX_LIST_FILES ||
    budget.bytes > MAX_LIST_BYTES
  ) {
    budget.truncated = true;
    issues.push({
      path,
      code: "list_truncated",
      message: `Listagem truncada ao atingir os limites (${MAX_LIST_FILES} arquivos, ${MAX_LIST_BYTES} bytes ou ${MAX_LIST_ENTRIES} entradas).`,
    });
    return true;
  }
  return false;
}

export interface FileStoreRoots {
  readonly repositoryRoot: string;
  readonly globalRoot: string;
  readonly backupRoot: string;
}

interface InternalFile {
  readonly content: string;
  readonly version: string;
  readonly mode: number;
}

function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function hashContent(content: string): string {
  return hashBuffer(Buffer.from(content, "utf8"));
}

function assertValidName(name: string): void {
  if (!isValidResourceName(name)) {
    const reason = describeInvalidResourceName(name) ?? "Nome inválido.";
    throw new StudioError("unsafe_path", reason);
  }
}

export class FsFileStore implements FileStore {
  private readonly roots: FileStoreRoots;

  constructor(roots: FileStoreRoots) {
    this.roots = roots;
  }

  private scopeRoot(scope: Scope): string {
    return scope === "global" ? this.roots.globalRoot : join(this.roots.repositoryRoot, ".opencode");
  }

  private resolveTarget(target: LogicalTarget): { root: string; path: string } {
    assertValidName(target.name);
    const root = this.scopeRoot(target.scope);
    const targetPath =
      target.storage === "agent"
        ? join(root, "agents", `${target.name}.md`)
        : join(root, "skills", target.name, "SKILL.md");
    return { root, path: targetPath };
  }

  private async readInternal(target: LogicalTarget): Promise<InternalFile | null> {
    const { root, path: targetPath } = this.resolveTarget(target);
    await assertSafeTarget(root, targetPath);

    const stats = await lstatOrNull(targetPath);
    if (!stats) {
      return null;
    }
    if (stats.isSymbolicLink()) {
      throw new StudioError("unsafe_path", "O alvo é um link simbólico.");
    }
    if (!stats.isFile()) {
      throw new StudioError("unsupported", "O alvo não é um arquivo regular.");
    }
    if (stats.size > MAX_FILE_BYTES) {
      throw new StudioError(
        "payload_too_large",
        `O arquivo excede o limite de ${MAX_FILE_BYTES} bytes.`,
      );
    }

    const buffer = await readFile(targetPath);
    if (buffer.byteLength > MAX_FILE_BYTES) {
      throw new StudioError(
        "payload_too_large",
        `O arquivo excede o limite de ${MAX_FILE_BYTES} bytes.`,
      );
    }

    return {
      content: buffer.toString("utf8"),
      version: hashBuffer(buffer),
      mode: stats.mode,
    };
  }

  async read(target: LogicalTarget): Promise<FileContent | null> {
    const internal = await this.readInternal(target);
    if (!internal) {
      return null;
    }
    return { content: internal.content, version: internal.version };
  }

  private async listAgents(
    root: string,
    issues: ScanIssue[],
    budget: ListBudget,
  ): Promise<StoredFile[]> {
    const directory = join(root, "agents");
    try {
      await assertSafeTarget(root, directory);
    } catch (error) {
      issues.push(this.issueFromError("agents", error));
      return [];
    }

    let dir;
    try {
      dir = await opendir(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }

    const files: StoredFile[] = [];
    try {
      for await (const entry of dir) {
        if (budget.truncated) {
          break;
        }
        budget.entries += 1;
        if (applyTruncation(budget, issues, "agents")) {
          break;
        }

        const displayPath = `agents/${entry.name}`;
        if (!entry.isFile() || entry.isSymbolicLink()) {
          issues.push({
            path: displayPath,
            code: entry.isSymbolicLink() ? "symlink_skipped" : "not_a_file",
            message: entry.isSymbolicLink()
              ? "Link simbólico ignorado por segurança."
              : "Entrada ignorada: esperado um arquivo .md.",
          });
          continue;
        }
        if (!entry.name.endsWith(".md")) {
          issues.push({
            path: displayPath,
            code: "unsupported_extension",
            message: "Arquivo ignorado: agentes devem usar a extensão .md.",
          });
          continue;
        }

        const name = entry.name.slice(0, -3);
        if (!isValidResourceName(name)) {
          issues.push({
            path: displayPath,
            code: "invalid_name",
            message: describeInvalidResourceName(name) ?? "Nome de agente inválido.",
          });
          continue;
        }

        try {
          const stored = await this.readStored({ scope: this.currentScope(root), storage: "agent", name });
          if (stored) {
            budget.files += 1;
            budget.bytes += stored.size;
            if (applyTruncation(budget, issues, "agents")) {
              break;
            }
            files.push(stored);
          }
        } catch (error) {
          issues.push(this.issueFromError(displayPath, error));
        }
      }
    } finally {
      await dir.close().catch(() => undefined);
    }

    return files;
  }

  private currentScope(root: string): Scope {
    return root === this.roots.globalRoot ? "global" : "repository";
  }

  private async readStored(target: LogicalTarget): Promise<StoredFile | null> {
    const internal = await this.readInternal(target);
    if (!internal) {
      return null;
    }
    return {
      target,
      raw: internal.content,
      version: internal.version,
      size: Buffer.byteLength(internal.content, "utf8"),
    };
  }

  private async listSkills(
    root: string,
    issues: ScanIssue[],
    budget: ListBudget,
  ): Promise<StoredFile[]> {
    const directory = join(root, "skills");
    try {
      await assertSafeTarget(root, directory);
    } catch (error) {
      issues.push(this.issueFromError("skills", error));
      return [];
    }

    let dir;
    try {
      dir = await opendir(directory);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }

    const files: StoredFile[] = [];
    try {
      for await (const entry of dir) {
        if (budget.truncated) {
          break;
        }
        budget.entries += 1;
        if (applyTruncation(budget, issues, "skills")) {
          break;
        }

        const displayPath = `skills/${entry.name}`;
        if (!entry.isDirectory() || entry.isSymbolicLink()) {
          issues.push({
            path: displayPath,
            code: entry.isSymbolicLink() ? "symlink_skipped" : "not_a_directory",
            message: entry.isSymbolicLink()
              ? "Link simbólico ignorado por segurança."
              : "Entrada ignorada: skills devem ser diretórios.",
          });
          continue;
        }

        if (!isValidResourceName(entry.name)) {
          issues.push({
            path: displayPath,
            code: "invalid_name",
            message: describeInvalidResourceName(entry.name) ?? "Nome de skill inválido.",
          });
          continue;
        }

        const skillFile = join(directory, entry.name, "SKILL.md");
        const stats = await lstatOrNull(skillFile);
        if (!stats) {
          issues.push({
            path: `${displayPath}/SKILL.md`,
            code: "missing_skill_file",
            message: "Diretório de skill sem SKILL.md.",
          });
          continue;
        }

        try {
          const stored = await this.readStored({
            scope: this.currentScope(root),
            storage: "skill",
            name: entry.name,
          });
          if (stored) {
            budget.files += 1;
            budget.bytes += stored.size;
            if (applyTruncation(budget, issues, "skills")) {
              break;
            }
            files.push(stored);
          }
        } catch (error) {
          issues.push(this.issueFromError(`${displayPath}/SKILL.md`, error));
        }
      }
    } finally {
      await dir.close().catch(() => undefined);
    }

    return files;
  }

  private issueFromError(path: string, error: unknown): ScanIssue {
    if (error instanceof StudioError) {
      return { path, code: error.code, message: error.message };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { path, code: "read_error", message };
  }

  async list(scope: Scope): Promise<ListReport> {
    const root = this.scopeRoot(scope);
    const issues: ScanIssue[] = [];
    const budget: ListBudget = { entries: 0, files: 0, bytes: 0, truncated: false };
    const files: StoredFile[] = [
      ...(await this.listAgents(root, issues, budget)),
      ...(await this.listSkills(root, issues, budget)),
    ];
    return { files, issues };
  }

  async apply(plan: FileChangePlan): Promise<ApplyReport> {
    if (plan.operations.length !== 1) {
      throw new StudioError(
        "unsupported",
        "O MVP aplica exatamente uma operação por plano (sem transação multiarquivo).",
      );
    }

    const operation = plan.operations[0] as FileOperation;
    if (operation.type === "create") {
      return this.create(operation.target, operation.content);
    }
    if (operation.type === "update") {
      return this.update(operation.target, operation.content, operation.expectedVersion);
    }
    return this.remove(operation.target, operation.expectedVersion);
  }

  async create(target: LogicalTarget, content: string): Promise<ApplyReport> {
    const { root, path: targetPath } = this.resolveTarget(target);

    const buffer = Buffer.from(content, "utf8");
    if (buffer.byteLength > MAX_FILE_BYTES) {
      throw new StudioError(
        "payload_too_large",
        `O conteúdo excede o limite de ${MAX_FILE_BYTES} bytes.`,
      );
    }

    await assertSafeTarget(root, targetPath);
    await mkdir(dirname(targetPath), { recursive: true, mode: 0o700 });
    await assertSafeTarget(root, targetPath);

    let handle;
    try {
      handle = await open(targetPath, "wx", 0o600);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new StudioError(
          "conflict",
          "Já existe um recurso com esse nome neste escopo (agentes e subagentes compartilham a mesma pasta).",
        );
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new StudioError("internal", `Falha ao criar o recurso: ${message}`);
    }

    try {
      await handle.writeFile(content, "utf8");
      await handle.sync();
    } catch (error) {
      await handle.close().catch(() => undefined);
      await rm(targetPath, { force: true }).catch(() => undefined);
      const message = error instanceof Error ? error.message : String(error);
      throw new StudioError("internal", `Falha ao gravar o recurso: ${message}`);
    }

    await handle.close().catch(() => undefined);

    return { applied: 1, result: { content, version: hashContent(content) } };
  }

  private async update(
    target: LogicalTarget,
    content: string,
    expectedVersion: string,
  ): Promise<ApplyReport> {
    const { root, path: targetPath } = this.resolveTarget(target);

    return withLock(targetPath, async () => {
      const current = await this.readInternal(target);
      if (!current) {
        throw new StudioError("not_found", "O recurso não existe.");
      }
      if (current.version !== expectedVersion) {
        throw new StudioError(
          "conflict",
          "O recurso foi alterado desde a última leitura (versão divergente).",
        );
      }

      await assertSafeTarget(root, targetPath);
      const backup = await createBackup({
        backupRoot: this.roots.backupRoot,
        sourcePath: targetPath,
        relativePath: relative(root, targetPath),
        scope: target.scope,
        storage: target.storage,
        name: target.name,
        version: current.version,
        operation: "update",
      });

      const recheck = await this.readInternal(target);
      if (!recheck || recheck.version !== expectedVersion) {
        throw new StudioError(
          "conflict",
          "O recurso foi alterado por outro processo durante o backup.",
        );
      }

      const buffer = Buffer.from(content, "utf8");
      if (buffer.byteLength > MAX_FILE_BYTES) {
        throw new StudioError(
          "payload_too_large",
          `O conteúdo excede o limite de ${MAX_FILE_BYTES} bytes.`,
        );
      }

      const tempPath = join(
        dirname(targetPath),
        `.blipo-${randomBytes(8).toString("hex")}.tmp`,
      );

      try {
        const handle = await open(tempPath, "wx", 0o600);
        try {
          await handle.writeFile(content, "utf8");
          await handle.sync();
        } finally {
          await handle.close().catch(() => undefined);
        }
        await chmod(tempPath, current.mode);
      } catch (error) {
        await rm(tempPath, { force: true }).catch(() => undefined);
        const message = error instanceof Error ? error.message : String(error);
        throw new StudioError("internal", `Falha ao preparar a atualização: ${message}`);
      }

      try {
        await assertSafeTarget(root, targetPath);
        const beforeRename = await this.readInternal(target);
        if (!beforeRename || beforeRename.version !== expectedVersion) {
          await rm(tempPath, { force: true }).catch(() => undefined);
          throw new StudioError("conflict", "O recurso foi alterado antes da gravação.");
        }
        await rename(tempPath, targetPath);
      } catch (error) {
        await rm(tempPath, { force: true }).catch(() => undefined);
        if (error instanceof StudioError) {
          throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        throw new StudioError("internal", `Falha ao gravar a atualização: ${message}`);
      }

      return { applied: 1, backup, result: { content, version: hashContent(content) } };
    });
  }

  private async remove(target: LogicalTarget, expectedVersion: string): Promise<ApplyReport> {
    const { root, path: targetPath } = this.resolveTarget(target);

    return withLock(targetPath, async () => {
      const current = await this.readInternal(target);
      if (!current) {
        throw new StudioError("not_found", "O recurso não existe.");
      }
      if (current.version !== expectedVersion) {
        throw new StudioError(
          "conflict",
          "O recurso foi alterado desde a última leitura (versão divergente).",
        );
      }

      await assertSafeTarget(root, targetPath);
      const backup = await createBackup({
        backupRoot: this.roots.backupRoot,
        sourcePath: targetPath,
        relativePath: relative(root, targetPath),
        scope: target.scope,
        storage: target.storage,
        name: target.name,
        version: current.version,
        operation: "delete",
      });

      const recheck = await this.readInternal(target);
      if (!recheck || recheck.version !== expectedVersion) {
        throw new StudioError(
          "conflict",
          "O recurso foi alterado por outro processo durante o backup.",
        );
      }

      await assertSafeTarget(root, targetPath);
      await unlink(targetPath);
      return { applied: 1, backup };
    });
  }
}
