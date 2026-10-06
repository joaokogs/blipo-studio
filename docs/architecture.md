# Arquitetura

## Visão geral

O Blipo Studio é um **monólito modular local-first**. O núcleo concentra domínio e casos de uso;
Next, CLI e adaptadores de I/O ficam nas bordas. O provider OpenCode está implementado; a leitura e
escrita são mediadas por um `FileStore` seguro.

## Camadas

| Camada | Caminho | Responsabilidade |
| --- | --- | --- |
| Domínio | `src/core/domain` | Tipos puros: `Resource`, `Capability`, `Operation` (inclui `list`), `ProviderDescriptor`, validação de nome, `Diagnostic` e erros (`StudioError`). |
| Portas | `src/core/ports` | Contratos: `ProviderCatalog`, `ProviderAdapter` (planeja + valida), `FileStore` (list/read/apply). |
| Aplicação | `src/core/application` | Casos de uso: `listProviders`, `listResources`, `readResource`, `validateResource`, `createResource`, `updateResource`, `deleteResource`. |
| Providers | `src/providers` | Catálogo e `openCodeAdapter` (frontmatter YAML, templates, capabilities). |
| Features | `src/features/studio` | UI funcional (listar, criar, ler, validar, salvar, remover, diff, conflitos). |
| App / API | `src/app` | Next App Router + rotas `/api/session` e `/api/resources/*`. |
| Infraestrutura | `src/infrastructure` | `FsFileStore` seguro, backup, mutex por alvo e sessão lida de env. |
| CLI | `src/cli` | `blipo start`: fixa o workspace, gera a sessão e sobe o Next `standalone`. |

## Direção de dependências

```
app (Next) / CLI ──▶ application ──▶ ports ◀── adapters (infrastructure, providers)
                                  └──▶ domain ◀── usado por todas (não depende de ninguém)
```

- O **domínio** não importa Next, disco nem rede.
- Os **adaptadores** são a única camada com I/O.
- A **API** é transporte: valida Zod, autentica e delega para `application`; não duplica regras.

## Modelo de recursos (OpenCode)

- `agent` e `subagent` compartilham o armazenamento `agents/<nome>.md`. A distinção é o frontmatter
  `mode`: `primary` -> agente, `subagent` -> subagente, `all`/ausente -> agente (modo `all`
  mostrado e preservado).
- `skill` usa `skills/<nome>/SKILL.md`. O `name` do frontmatter deve ser igual ao nome da pasta e
  seguir `^[a-z0-9]+(-[a-z0-9]+)*$` (1–64). `description` é obrigatória (1–1024).
- O campo `description` de agentes é obrigatório. Campos conhecidos têm tipos relevantes
  validados; campos desconhecidos são preservados (com aviso) e o arquivo **nunca é
  reserializado**.

## ProviderAdapter x FileStore

- `ProviderAdapter` planeja mudanças **sem tocar o disco** e valida conteúdo/frontmatter.
- `FileStore` concentra o I/O. `apply` aceita **um** plano com **uma** operação (`create`,
  `update` ou `delete`), sempre com alvo lógico `{ scope, storage, name }`.

### Regras do FileStore

- Escopos fixos: repositório (`<workspace>/.opencode`) e global (`<globalRoot>`).
- Nomes validados no domínio e novamente no adaptador (defesa em profundidade).
- Rejeita traversal, `\`, drive/ADS, nomes reservados do Windows e symlink/junction em qualquer
  ancestral existente (`lstat` + contenção por `realpath`).
- `create` usa `wx` (exclusivo); `update` grava em temporário no mesmo diretório (`wx` 0600),
  preserva modo e faz `rename`; `delete` remove apenas o arquivo-alvo.
- `expectedVersion` (SHA-256) é obrigatório em `update`/`delete` e reconferido após o backup e
  imediatamente antes de `rename`/`unlink`.
- Serialização por alvo via mutex em processo. **Sem** lock entre aplicações e **sem CAS**:
  garantimos atomicidade **por arquivo** (`rename`), não compare-and-swap. Um editor externo pode
  alterar o arquivo entre a última checagem e a gravação (TOCTOU residual documentado).
- `list` trunca por escopo em 200 arquivos / 16 MiB / 1000 entradas e reporta `list_truncated`,
  em vez de retornar uma listagem incompleta silenciosamente.

## Backups

Antes de `update`/`delete`, o conteúdo atual é copiado para um diretório de backup com
`manifest.json`. Backups não expiram. Falha de backup aborta a operação sem alterar o original.
O diretório é resolvido por `--backup-dir`, `%LOCALAPPDATA%`, `$XDG_DATA_HOME` ou
`~/.local/share`.

## API e sessão

- A sessão é criada pela CLI e passada ao servidor por variáveis `BLIPO_*` (server-only). Sem
  sessão, tudo é 401 (fail-closed).
- Todas as rotas exigem token (`x-blipo-token`, `timingSafeEqual`), `Host` exato
  (`127.0.0.1:<porta>`) e, quando presente, `Origin` exato; mutações exigem `Origin`.
- Corpo limitado a 1 MiB (contagem por stream, cobre `chunked`).
- `/api/session` devolve workspace, diretório de backup, escopos, providers e capabilities — nunca
  o token.

## Empacotamento

- `next build` com `output: "standalone"`; assets copiados para `.next/standalone` via script Node
  portátil (sem shell string).
- `dist/cli.js` gerado por tsup (CJS, bundled).
- `package.json#files` inclui `dist`, `.next/standalone`, `docs` e `README.md`. Pacote **privado**:
  `npm pack` funciona, `publish` permanece bloqueado.

## Limites atuais e não-objetivos

- Apenas OpenCode implementado; Codex/Claude Code planejados com capabilities vazias.
- Fora do MVP: config inline JSON/JSONC, diretórios singulares legados, `.claude`/`.agents` e
  subdiretórios de agentes.
- Sem banco de dados, sem execução de agentes, sem transação multiarquivo.
- Validado apenas em Windows.
