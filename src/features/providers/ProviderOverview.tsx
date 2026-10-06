import type { ProviderDescriptor } from "@/core/domain";

const STATUS_LABEL: Record<string, string> = {
  planned: "planejado",
  implemented: "implementado",
};

interface ProviderOverviewProps {
  providers: readonly ProviderDescriptor[];
}

export function ProviderOverview({ providers }: ProviderOverviewProps) {
  if (providers.length === 0) {
    return <p className="text-zinc-600 dark:text-zinc-400">Nenhum provider registrado.</p>;
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {providers.map((provider) => (
        <li
          key={provider.id}
          className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">{provider.name}</h3>
            <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
              {STATUS_LABEL[provider.implementationStatus] ?? provider.implementationStatus}
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-500">{provider.id}</p>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            {provider.capabilities.length === 0
              ? "Nenhuma capability validada."
              : `${provider.capabilities.length} capability(s) registrada(s).`}
          </p>
        </li>
      ))}
    </ul>
  );
}
