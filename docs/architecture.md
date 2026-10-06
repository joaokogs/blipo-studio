# Arquitetura

## Visão geral

O Blipo Studio é um **monólito modular local-first**. O núcleo concentra domínio e casos de uso;
a interface (Next) e as futuras integrações (CLI, adaptadores de I/O) ficam nas bordas.

## Camadas

| Camada | Caminho | Responsabilidade |
| --- | --- | --- |
| Domínio | `src/core/domain` | Tipos puros: `ResourceKind`, `Scope`, `ProviderId`, `Resource`, `Capability`, `ProviderDescriptor` e o helper `canPerform`. |
| Portas | `src/core/ports` | Contratos: `ProviderCatalog`, `ProviderAdapter`, `FileStore`. |
| Aplicação | `src/core/application` | Casos de uso, como `listProviders`. |
| Providers | `src/providers` | Catálogo com os providers planejados. |
| Features | `src/features` | Componentes informativos de interface. |
| App | `src/app` | Landing page (Next App Router). |
| Infraestrutura | `src/infrastructure` | Futuro: adaptadores concretos das portas. |
| CLI | `src/cli` | Futuro: interface de linha de comando. |

## Direção de dependências

```
app (Next) ──┐
futura CLI ──┼──▶ application ──▶ ports ◀── adapters (infrastructure)
             │
             └──▶ domain  ◀── usado por todas as camadas (não depende de ninguém)
```

- O **domínio** não importa Next, disco, rede, portas nem adaptadores; as demais camadas é que
  dependem dele.
- A **aplicação** depende de domínio e portas.
- Os **adaptadores** implementam as portas; são a única camada autorizada a fazer I/O.
- A futura **API Next** é transporte: recebe requisição, chama `application`, devolve resposta.

### Tipos de adaptador

- **Adapter de provider** (ex.: OpenCode, Codex, Claude Code): traduz um pedido de mudança em um
  `FileChangePlan`, **sem tocar o disco**.
- **Adapter de filesystem** (futuro `FileStore`): recebe o plano e é quem faz o I/O real, de
  forma segura.

## Contratos principais

- `ProviderCatalog.listProviders()`: fonte dos `ProviderDescriptor`.
- `ProviderAdapter.planChanges()`: **planeja** alterações sem I/O direto.
- `FileStore`:
  - `read` retorna `content` + `version`;
  - `apply` recebe um plano com operações discriminadas `create` / `update` / `delete`;
  - o alvo é **lógico e escopado** (`scope` + `path`), nunca um caminho absoluto;
  - `expectedVersion` é **exigido** em `update` e `delete` e **ausente** em `create`.

## Regra de capability

`canPerform` só retorna `true` quando o provider está `implemented` e existe capability com
status `verified` para a combinação de recurso, escopo e operação. Um provider `planned`
permanece desabilitado mesmo que exista capability `verified`.

O catálogo atual declara os três providers como `planned` e com `capabilities` **vazias**, pois
a matriz de suporte ainda não foi validada — combinações não devem ser inventadas.

## Limites e não-objetivos atuais

- Não há CRUD, endpoints de disco nem CLI operacional.
- `src/infrastructure`, `src/cli`, `src/components/ui` e `tests/fixtures` contêm apenas
  documentação de limites futuros.
- Arquivos fonte são a fonte da verdade; não há banco de dados nem execução de agentes.
- `blipo start` e a CLI standalone são objetivos futuros.

## Fluxo futuro do `blipo start`

Objetivo futuro, **não implementado**:

1. `blipo start` captura o **cwd** do repositório.
2. sobe um **servidor Next de produção** em **loopback**;
3. abre o **browser**;
4. o browser fala com a **API** Next;
5. a API chama `application`;
6. a aplicação usa um **adapter de provider** (planeja, sem disco) e um **adapter de
   filesystem** (faz o I/O) via `FileStore`.

Regras do pacote futuro:

- o **diretório de instalação não é o workspace**; o workspace é **fixado pelo processo** no
  `blipo start`, nunca um caminho arbitrário vindo do browser;
- será um **pacote npm** com o build `standalone` do Next, a CLI e os assets estáticos
  (`.next/static/` e `public/`), resolvidos a partir da instalação;
- exige um **protótipo validado com `npm pack`**, instalado **fora do checkout** — ainda não
  implementado.

## Limites de I/O

- Não prometer **atomicidade de múltiplos arquivos**; a escrita atômica por arquivo é um
  requisito futuro que precisa ser validado nas plataformas suportadas.
- Sem confirmação da especificação de segurança, nenhum adaptador de filesystem deve ser criado.

## Segurança antes do I/O real

Qualquer implementação de `FileStore`/adaptador precisa tratar, na ordem:

1. binding em loopback;
2. validação de `Origin` e `Host`;
3. token local e proteção CSRF;
4. prevenção de path traversal;
5. bloqueio de symlinks que escapem do escopo;
6. escrita atômica **por arquivo** (sem prometer atomicidade de múltiplos arquivos);
7. detecção de conflitos via `expectedVersion`.

## Stack

**Atual:** Next.js 16, React 19, TypeScript `strict`, Tailwind CSS 4, Vitest, npm.

**Recomendada:** manter o núcleo livre de framework, adicionar adaptadores de I/O somente após
fechar o desenho de segurança, e expor a API Next como casca fina sobre a aplicação.
