# CLI

A CLI `blipo` é uma casca fina sobre o servidor Next `standalone`. Ela **não executa agentes**.

## Comandos

```bash
blipo start [--port N] [--no-open] [--session-file PATH] [--global-config-dir PATH] [--backup-dir PATH]
```

## Responsabilidades

- Fixar o **workspace** no `cwd` do processo (nunca um caminho vindo do navegador).
- Resolver a raiz global (`--global-config-dir` / `OPENCODE_CONFIG_DIR` / `~/.config/opencode`).
- Gerar o token da sessão (32 bytes) e exportá-lo ao servidor por variáveis `BLIPO_*`.
- Subir o Next `standalone` em `127.0.0.1` e, por padrão, abrir o navegador com o token no
  fragmento.
- `--session-file PATH`: grava um handoff JSON (origem, URL de bootstrap, token) em arquivo
  exclusivo (`wx`, 0600), valida ancestrais contra symlink, não imprime o token e remove o arquivo
  no shutdown.
- `--no-open` sem handoff roda em modo headless (não abre navegador e não imprime token).
- Encerrar o filho em `SIGINT`/`SIGTERM` e em falha de readiness/abertura, limpando o handoff.

O diretório de instalação é resolvido a partir do `dist/cli.js`; nenhum @-file é resolvido pelo
`cwd`.
