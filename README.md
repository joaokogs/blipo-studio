# Blipo Studio

Plataforma **local-first** para gerenciar agentes, subagentes e skills a partir de arquivos
fonte. O Blipo Studio segue uma arquitetura de **monólito modular**, com o domínio isolado da
interface e das dependências externas.

> Estado atual: **scaffold inicial**. Nenhum provider está implementado, a matriz de
> capabilities ainda não foi validada e as operações de CRUD **não estão disponíveis**.

## Stack atual

- Next.js 16 (App Router) + React 19
- TypeScript em modo `strict`
- Tailwind CSS 4
- Vitest (testes de domínio e aplicação, sem Next)
- npm

## Stack recomendada para evolução

- Manter o núcleo (`src/core`) sem dependência de Next, disco ou rede.
- Adicionar adaptadores concretos em `src/infrastructure` quando houver especificação de
  segurança de I/O.
- Expor a futura API do Next apenas como camada de transporte sobre `src/core/application`.

## Estrutura

```
src/
  core/
    domain/       # tipos e regras puras (Resource, Capability, ProviderDescriptor, canPerform)
    ports/        # contratos (ProviderCatalog, ProviderAdapter, FileStore)
    application/  # casos de uso (listProviders)
  providers/      # catálogo de providers planejados
  features/       # componentes de funcionalidade (informativo)
  app/            # landing page (Next App Router)
  infrastructure/ # futuro: adaptadores concretos
  cli/            # futuro: CLI
  components/ui/  # futuro: componentes reutilizáveis
```

Direção de dependências: `application -> ports <- adapters`, com `app` e a futura CLI
consumindo `application`. O `domain` é usado por todas as camadas e não depende de nenhuma.

## Objetivos futuros (não disponíveis)

- `blipo start`: comando standalone futuro da CLI.
- CRUD real de recursos com arquivos como fonte da verdade.
- API Next sobre a camada de aplicação.

## Segurança antes de qualquer I/O

Quando o I/O for implementado, os seguintes pontos precisam ser resolvidos **antes** de tocar
o disco:

- binding em loopback e validação de `Origin`/`Host`;
- token local e proteção CSRF;
- prevenção de path traversal e de symlinks que escapem do escopo;
- escrita atômica por arquivo e detecção de conflitos via `expectedVersion` (sem prometer
  atomicidade de múltiplos arquivos).

## Scripts

```bash
npm ci              # instala dependências travadas pelo lockfile
npm run dev         # ambiente de desenvolvimento Next
npm run build       # build de produção Next
npm run start       # serve o build de produção Next (não é a CLI Blipo)
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest (uma execução)
npm run test:watch  # Vitest em modo watch
```

## Documentação

- [`docs/architecture.md`](docs/architecture.md): decisões de arquitetura e limites.
