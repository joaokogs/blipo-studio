import { StudioClient } from "@/features/studio/StudioClient";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-12">
        <header className="flex flex-col gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
            Blipo Studio
          </h1>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Gerencie agentes, subagentes e skills do OpenCode como arquivos-fonte. O workspace é
            fixado pela CLI e todo acesso ao disco exige uma sessão local autenticada.
          </p>
        </header>

        <StudioClient />

        <section className="rounded-lg border border-zinc-200 bg-white p-5 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            Limites desta versão
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Somente o provider OpenCode está implementado; Codex e Claude Code seguem planejados.</li>
            <li>
              Escopo do MVP: <code>agents/&lt;nome&gt;.md</code> e{" "}
              <code>skills/&lt;nome&gt;/SKILL.md</code>. Subagentes são agentes com{" "}
              <code>mode: subagent</code>.
            </li>
            <li>
              Fora do MVP: config inline em JSON/JSONC, diretórios singulares legados,{" "}
              <code>.claude</code>/<code>.agents</code> e subdiretórios de agentes.
            </li>
            <li>
              A remoção de skill apaga apenas <code>SKILL.md</code>; scripts e assets da pasta são
              preservados.
            </li>
            <li>Nenhum agente é executado por esta ferramenta.</li>
          </ul>
          <p className="mt-3">
            Documentação oficial:{" "}
            <a
              className="underline"
              href="https://opencode.ai/docs/agents/"
              target="_blank"
              rel="noreferrer"
            >
              agents
            </a>
            {", "}
            <a
              className="underline"
              href="https://opencode.ai/docs/skills/"
              target="_blank"
              rel="noreferrer"
            >
              skills
            </a>
            {" e "}
            <a
              className="underline"
              href="https://opencode.ai/docs/config/"
              target="_blank"
              rel="noreferrer"
            >
              config
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
