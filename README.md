# Blipo Studio

Plataforma **local-first** para gerenciar agentes, subagentes e skills do [OpenCode](https://opencode.ai/docs/)
a partir de arquivos-fonte. O Blipo Studio segue uma arquitetura de **monólito modular**: o núcleo
(`src/core`) não depende de Next, disco ou rede; a interface (Next) e a CLI são cascas finas.

> Estado: **MVP funcional** para o provider OpenCode, validado em **Windows**. Ainda não há
> validação em macOS/Linux. Codex e Claude Code permanecem **planejados** (sem capabilities).

## O que funciona

- CRUD de **agentes** (`agents/<nome>.md`), **subagentes** (`agents/<nome>.md` com `mode: subagent`)
  e **skills** (`skills/<nome>/SKILL.md`), nos escopos **global** e **repositório**.
- Listagem com diagnóstico de arquivos inválidos/ilegais (não oculta nada silenciosamente).
- Validação de YAML frontmatter (mapping, sintaxe, chaves duplicadas, `mode`, `name`/`description`
  de skills) e **preservação integral do RAW** — arquivos nunca são reserializados.
- Edição via textarea de texto cru, com prévia de diff, confirmação de escopo global e de remoção.
- Backups **obrigatórios, com manifesto e sem expiração** antes de update/delete.

## Requisitos

- Node.js **>= 22.12** (o Next 16 pede 20.9+, mas a CLI usa `commander` 15, que pede 22.12).
- npm.

## Instalação e build

```bash
npm ci
npm run build     # Next (standalone) + assets + CLI
```

O `build` gera:

- `.next/standalone/` com `server.js` e os assets copiados (`.next/static`, `public/`);
- `dist/cli.js` (CLI `blipo`).

## Uso

```bash
npx blipo start [--port N] [--no-open] [--session-file PATH] [--global-config-dir PATH] [--backup-dir PATH]
```

- O **workspace é o diretório atual** (`cwd`), fixado pela CLI. O diretório de instalação do pacote
  nunca é o workspace.
- A raiz **global** do OpenCode é: `--global-config-dir` > `OPENCODE_CONFIG_DIR` >
  `~/.config/opencode`. Configurações existentes **não** são alteradas.
- A CLI gera um token aleatório de 32 bytes, sobe o Next `standalone` em **127.0.0.1** e abre o
  navegador com o token no **fragmento** `#token=...`. O token é removido da URL
  (`history.replaceState`) e mantido em `sessionStorage`.
- `--session-file PATH` grava um **handoff** JSON (origem, URL de bootstrap e token) num arquivo
  exclusivo (`wx`, modo 0600) e com ancestrais validados contra symlink. O token **nunca** é
  impresso; o arquivo é removido no shutdown. Trate-o como dado sensível.
- `--no-open` sem `--session-file` roda em modo **headless**: não abre o navegador e não imprime o
  token. Para handoff, use `--session-file`.
- A CLI só sobe o servidor Next. **Ela não executa agentes.**

Novos agentes gerados pela UI usam `mode: primary` por padrão e subagentes usam `mode: subagent`;
agentes existentes com `mode: all` (ou ausente) são preservados como estão.

Em desenvolvimento, `npm run dev:studio` faz build e inicia a CLI de forma prática.

## Scripts

```bash
npm run dev            # Next em desenvolvimento (sem sessão Blipo: fail-closed)
npm run build          # build completo (web + assets + CLI)
npm run build:web      # apenas Next standalone
npm run build:cli      # apenas a CLI (tsup)
npm run studio         # executa a CLI já construída
npm run dev:studio     # build + CLI
npm run lint           # ESLint
npm run typecheck      # tsc --noEmit
npm test               # Vitest
npm run test:e2e       # Playwright (build + servidor standalone em sandbox)
npm run e2e:install    # instala o Chromium do Playwright
```

## Segurança

- **Sessão fail-closed**: sem `blipo start` (variáveis `BLIPO_*` ausentes), `/api/*` responde 401.
- **Autenticação em todas as chamadas** (inclusive leitura): token via header `x-blipo-token`,
  comparado com `timingSafeEqual`.
- **Host exato** `127.0.0.1:<porta>`; **Origin exato** quando presente e **obrigatório** em mutações.
- **Sem CORS**; sem endpoints de shell ou de execução de agentes.
- Corpo de requisição limitado a **1 MiB** (inclusive com `Transfer-Encoding: chunked`).
- Erros tipados com status 400/401/403/404/409/413/422/500, sem vazar stack ou segredo.

### Caminhos e arquivos

- Alvos são **lógicos e escopados** (`agents/<nome>.md`, `skills/<nome>/SKILL.md`); nunca caminhos
  absolutos vindos do navegador.
- Rejeita traversal, `\`, drive/ADS, nomes reservados do Windows e nomes fora de
  `^[a-z0-9]+(-[a-z0-9]+)*$` (1–64 caracteres).
- Verifica `lstat`/`realpath` e rejeita symlink/junction em qualquer ancestral existente.
- Leitura limitada a 1 MiB; a versão é o **SHA-256** do conteúdo.
- `create` usa abertura exclusiva (`wx`) — nunca sobrescreve. Agentes e subagentes compartilham a
  pasta `agents/`, então um nome novo não pode colidir com o do outro tipo.
- `update` gravoso em arquivo temporário **no mesmo diretório** (`wx`, modo 0600), preserva
  permissões e faz `rename` atômico por arquivo. `expectedVersion` é obrigatório e reconferido após
  o backup.
- `delete` de skill remove **somente** `SKILL.md`, preservando scripts/assets e a pasta.

### Concorrência

Não há **compare-and-swap (CAS)** portável no Node nem **lock entre aplicações**. O hash de versão
(`expectedVersion`) reduz conflitos e é reconferido após o backup e imediatamente antes de
`rename`/`unlink`, mas um editor externo ainda pode alterar o arquivo entre a última checagem e a
gravação (janela **TOCTOU residual**). A escrita é atômica **por arquivo** (`rename`), o que **não**
equivale a CAS. Um conflito detectado nunca perde o rascunho: a UI oferece reler. Backups **não
expiram**.

### Limites de listagem

Para não acumular memória com diretórios enormes, a listagem trunca por escopo em **200 arquivos**,
**16 MiB** ou **1000 entradas** e retorna um diagnóstico explícito `list_truncated` — a listagem
nunca finge estar completa.

## Backups

- Diretório: `--backup-dir` > `%LOCALAPPDATA%/blipo-studio/backups` (Windows) >
  `$XDG_DATA_HOME/blipo-studio/backups` > `~/.local/share/blipo-studio/backups`.
- Nome: timestamp + hash + aleatório, com `manifest.json`. **Não expiram.**
- Se o backup falhar, a operação é **abortada** e o original permanece intacto.
- Backups podem conter dados sensíveis; trate o diretório como área restrita.

## Limites explícitos do MVP

- Config inline em JSON/JSONC, diretórios singulares legados, `.claude`/`.agents` e subdiretórios
  de agentes estão **fora do escopo**. Esses formatos não são equivalentes aos suportados.
- Sem banco de dados e sem editor visual de frontmatter (textarea cru).
- Sem transação multiarquivo: cada plano aplica **uma** operação.
- Sem validação em macOS/Linux (Windows validado).

## Documentação

- [`docs/architecture.md`](docs/architecture.md): camadas, portas e limites.
- Fontes oficiais: [agents](https://opencode.ai/docs/agents/),
  [skills](https://opencode.ai/docs/skills/), [config](https://opencode.ai/docs/config/).
