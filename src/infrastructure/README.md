# Infraestrutura

Esta pasta reunirá os adaptadores concretos das portas definidas em `src/core/ports`.

## Limites atuais

- Nada de I/O real de disco ou rede é implementado nesta versão.
- `FileStore` e `ProviderAdapter` são apenas contratos no núcleo; não há implementação de
  produção aqui ainda.

## Direção de dependência

`Next API (futura) -> application -> portas -> adaptador -> FileStore seguro`

Quando a implementação começar, todo acesso a arquivos deve passar por um `FileStore` seguro,
responsável por:

- restringir alvos lógicos a escopos `global` ou `repository`;
- bloquear traversal e symlinks que escapem do escopo;
- validar `expectedVersion` em `update`/`delete` para detectar conflitos;
- aplicar alterações de forma atômica.

Não criar adaptadores "de mentira" que finjam executar mudanças.
