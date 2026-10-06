# CLI

Esta pasta abrigará, no futuro, a interface de linha de comando do Blipo Studio.

## Limites atuais

- Não existe CLI operacional nesta versão e nenhum binário deve ser exposto.
- O comando `blipo start` é um objetivo futuro, não algo disponível agora.
- Nada de pacote npm público, build `standalone` ou assets estáticos é produzido aqui ainda.

## Direção prevista

- A CLI deve ser uma casca fina sobre `src/core/application`, sem regra de negócio própria.
- Toda escrita deve passar pelas mesmas portas de núcleo usadas pela futura API.

## Fluxo futuro do `blipo start` (não implementado)

1. `blipo start` captura o **cwd** do repositório;
2. sobe um **servidor Next de produção** em **loopback**;
3. abre o **browser**;
4. o browser fala com a **API** Next;
5. a API chama `application`;
6. a aplicação usa um **adapter de provider** (planeja mudanças, sem tocar o disco) e um
   **adapter de filesystem** (faz o I/O real) através do `FileStore`.

Precisões:

- O **diretório de instalação não é o workspace**. O workspace é **fixado pelo processo** no
  `blipo start`, nunca um caminho arbitrário enviado pelo browser.
- O pacote npm futuro empacota o Next `standalone`, a CLI e os assets estáticos (`public/`).
- A validação exige um **protótipo com `npm pack` instalado fora do checkout**.
- Não prometer **atomicidade de múltiplos arquivos**; a garantia é por arquivo.

Não adicione comandos falsos ou stubs que sugiram funcionalidade inexistente.
