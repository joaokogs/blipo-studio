import { listProviders } from "@/core/application";
import { SCOPES } from "@/core/domain";
import { ProviderOverview } from "@/features/providers/ProviderOverview";
import { providerCatalog } from "@/providers/catalog";

const SCOPE_LABEL: Record<string, string> = {
  global: "Configuração do usuário",
  repository: "Dentro do repositório",
};

export default function Home() {
  const providers = listProviders(providerCatalog);

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-6 py-16">
        <header className="flex flex-col gap-3">
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Blipo Studio
          </h1>
          <p className="text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Plataforma local-first para gerenciar agentes, subagentes e skills a partir de arquivos
            fonte.
          </p>
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Providers planejados</h2>
          <ProviderOverview providers={providers} />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Escopos</h2>
          <ul className="flex flex-col gap-2">
            {SCOPES.map((scope) => (
              <li key={scope} className="text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-mono text-xs text-zinc-500">{scope}</span> — {SCOPE_LABEL[scope]}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-amber-300 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
          <h2 className="text-base font-semibold text-amber-900 dark:text-amber-200">
            CRUD indisponível
          </h2>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
            Nenhum provider está implementado e a matriz de capabilities ainda não foi validada.
            Criar, ler, atualizar ou remover recursos não está disponível nesta versão.
          </p>
        </section>
      </main>
    </div>
  );
}
