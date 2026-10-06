#!/usr/bin/env node
import { Command } from "commander";
import { runStart } from "./start";

const program = new Command();

program
  .name("blipo")
  .description("Blipo Studio — gestão local-first de agentes, subagentes e skills do OpenCode.")
  .version("0.2.0");

program
  .command("start")
  .description("Inicia o servidor local do Blipo Studio (não executa agentes).")
  .option("--port <number>", "porta em loopback (padrão: 4173)", (value) => Number.parseInt(value, 10))
  .option("--no-open", "não abrir o navegador automaticamente")
  .option("--global-config-dir <path>", "diretório de configuração global do OpenCode")
  .option("--backup-dir <path>", "diretório de backups (sem expiração)")
  .option("--session-file <path>", "grava o handoff de sessão (JSON com token) em arquivo exclusivo")
  .action(async (options: {
    port?: number;
    open: boolean;
    globalConfigDir?: string;
    backupDir?: string;
    sessionFile?: string;
  }) => {
    await runStart({
      port: options.port,
      open: options.open,
      globalConfigDir: options.globalConfigDir,
      backupDir: options.backupDir,
      sessionFile: options.sessionFile,
    });
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`blipo: ${message}`);
  process.exit(1);
});
