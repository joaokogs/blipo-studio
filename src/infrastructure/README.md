# Infraestrutura

Adaptadores concretos das portas em `src/core/ports`.

## Conteúdo

- `fs/fs-file-store.ts`: implementação segura do `FileStore` (list/read/create/update/delete).
- `fs/security.ts`: validação de symlink/junction e contenção por `realpath`.
- `fs/backup.ts`: backups obrigatórios, com manifesto e sem expiração.
- `fs/mutex.ts`: serialização por alvo dentro do processo.
- `session.ts`: leitura da sessão das variáveis `BLIPO_*` (server-only).

## Garantias

- Alvos lógicos escopados; rejeita traversal, `\`, drive/ADS, nomes reservados e links.
- Leitura limitada a 1 MiB; versão por SHA-256.
- Escrita atômica **por arquivo**; sem transação multiarquivo e sem lock entre aplicações.
