"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResourceKind, Scope } from "@/core/domain";
import { ApiError, studioApi, type Diagnostic, type ListedResource, type SessionInfo } from "./api";
import { diffLines } from "./diff";

const STORAGE_KEY = "blipo.token";
const PROVIDER = "opencode";

type Connection =
  | { status: "loading" }
  | { status: "disconnected" }
  | { status: "ready"; session: SessionInfo };

interface Draft {
  mode: "existing" | "new";
  scope: Scope;
  kind: ResourceKind;
  name: string;
  original: string;
  content: string;
  version: string | null;
  diagnostics: readonly Diagnostic[];
  validationOk: boolean | null;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

const KIND_LABEL: Record<string, string> = {
  agent: "Agente",
  subagent: "Subagente",
  skill: "Skill",
};

const SCOPE_LABEL: Record<string, string> = {
  global: "Global",
  repository: "Repositório",
};

export function StudioClient() {
  const [token, setToken] = useState<string | null>(null);
  const [connection, setConnection] = useState<Connection>({ status: "loading" });
  const [resources, setResources] = useState<readonly ListedResource[]>([]);
  const [scanDiagnostics, setScanDiagnostics] = useState<readonly Diagnostic[]>([]);
  const [scopeFilter, setScopeFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [listError, setListError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [newKind, setNewKind] = useState<ResourceKind>("agent");
  const [newScope, setNewScope] = useState<Scope>("repository");
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [globalConfirmed, setGlobalConfirmed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const generation = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      let stored: string | null = null;
      try {
        stored = window.sessionStorage.getItem(STORAGE_KEY);
      } catch {
        stored = null;
      }

      const hash = window.location.hash;
      let fragmentToken: string | null = null;
      if (hash.startsWith("#token=")) {
        fragmentToken = decodeURIComponent(hash.slice("#token=".length));
      }

      const effective = fragmentToken ?? stored;
      if (fragmentToken) {
        try {
          window.sessionStorage.setItem(STORAGE_KEY, fragmentToken);
        } catch {
          // sessão apenas em memória
        }
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }

      if (!effective) {
        setConnection({ status: "disconnected" });
        return;
      }

      setToken(effective);
      let session: SessionInfo;
      try {
        session = await studioApi.getSession(effective);
      } catch (error) {
        if (!cancelled) {
          setConnection({ status: "disconnected" });
          setListError(describeError(error));
        }
        return;
      }
      if (cancelled) {
        return;
      }
      setConnection({ status: "ready", session });

      const request = (generation.current += 1);
      try {
        const list = await studioApi.list(effective, PROVIDER, undefined);
        if (!cancelled && request === generation.current) {
          setResources(list.resources);
          setScanDiagnostics(list.diagnostics);
          setListError(null);
        }
      } catch (error) {
        if (!cancelled && request === generation.current) {
          setListError(describeError(error));
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadFor = useCallback(
    async (scopeValue: string) => {
      if (!token) {
        return;
      }
      const request = (generation.current += 1);
      try {
        const response = await studioApi.list(
          token,
          PROVIDER,
          scopeValue === "all" ? undefined : scopeValue,
        );
        if (request !== generation.current) {
          return;
        }
        setResources(response.resources);
        setScanDiagnostics(response.diagnostics);
        setListError(null);
      } catch (error) {
        if (request !== generation.current) {
          return;
        }
        setListError(describeError(error));
      }
    },
    [token],
  );

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      await loadFor(scopeFilter);
    } finally {
      setBusy(false);
    }
  }, [loadFor, scopeFilter]);

  const filtered = useMemo(
    () => resources.filter((resource) => kindFilter === "all" || resource.kind === kindFilter),
    [resources, kindFilter],
  );

  const dirty = draft !== null && draft.content !== draft.original;

  async function openResource(resource: ListedResource) {
    if (!token || busy) {
      return;
    }
    setBusy(true);
    setConflict(null);
    setMessage(null);
    setConfirmDelete(false);
    setGlobalConfirmed(false);
    try {
      const response = await studioApi.read(token, {
        provider: PROVIDER,
        scope: resource.scope,
        kind: resource.kind,
        name: resource.name,
      });
      setDraft({
        mode: "existing",
        scope: resource.scope,
        kind: resource.kind,
        name: resource.name,
        original: response.raw,
        content: response.raw,
        version: response.version,
        diagnostics: response.diagnostics,
        validationOk: null,
      });
    } catch (error) {
      setMessage(describeError(error));
    } finally {
      setBusy(false);
    }
  }

  async function selectResource(resource: ListedResource) {
    if (
      dirty &&
      !window.confirm("Há alterações não salvas. Descartar o rascunho e abrir outro recurso?")
    ) {
      return;
    }
    await openResource(resource);
  }

  async function generateTemplate() {
    if (!token || busy) {
      return;
    }
    if (
      dirty &&
      !window.confirm("Há alterações não salvas. Descartar o rascunho e gerar um novo template?")
    ) {
      return;
    }
    setBusy(true);
    setMessage(null);
    setConflict(null);
    setGlobalConfirmed(false);
    try {
      const response = await studioApi.template(token, {
        provider: PROVIDER,
        kind: newKind,
        name: newName,
        description: newDescription,
      });
      setDraft({
        mode: "new",
        scope: newScope,
        kind: newKind,
        name: newName,
        original: "",
        content: response.content,
        version: null,
        diagnostics: [],
        validationOk: null,
      });
    } catch (error) {
      setMessage(describeError(error));
    } finally {
      setBusy(false);
    }
  }

  async function validateDraft() {
    if (!token || !draft || busy) {
      return;
    }
    setBusy(true);
    try {
      const response = await studioApi.validate(token, {
        provider: PROVIDER,
        scope: draft.scope,
        kind: draft.kind,
        name: draft.name,
        content: draft.content,
      });
      setDraft((current) =>
        current
          ? { ...current, diagnostics: response.diagnostics, validationOk: response.ok }
          : current,
      );
    } catch (error) {
      setMessage(describeError(error));
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!token || !draft || busy) {
      return;
    }
    if (draft.scope === "global" && !globalConfirmed) {
      setMessage("Confirme a gravação no escopo global antes de salvar.");
      return;
    }

    setBusy(true);
    setConflict(null);
    setMessage(null);
    try {
      if (draft.mode === "new") {
        const response = await studioApi.mutate(token, {
          provider: PROVIDER,
          action: "create",
          scope: draft.scope,
          kind: draft.kind,
          name: draft.name,
          content: draft.content,
        });
        setMessage(
          `Recurso criado. Backup: ${response.report.backup?.id ?? "não aplicável"}.`,
        );
        setDraft((current) =>
          current && response.report.result
            ? {
                ...current,
                mode: "existing",
                original: response.report.result.content,
                content: response.report.result.content,
                version: response.report.result.version,
                validationOk: true,
              }
            : current,
        );
      } else {
        if (!draft.version) {
          setMessage("Versão desconhecida; releia o recurso antes de salvar.");
          return;
        }
        const response = await studioApi.mutate(token, {
          provider: PROVIDER,
          action: "update",
          scope: draft.scope,
          kind: draft.kind,
          name: draft.name,
          content: draft.content,
          expectedVersion: draft.version,
        });
        setMessage(
          `Recurso atualizado. Backup: ${response.report.backup?.id ?? "não aplicável"}.`,
        );
        setDraft((current) =>
          current && response.report.result
            ? {
                ...current,
                original: response.report.result.content,
                content: response.report.result.content,
                version: response.report.result.version,
                validationOk: true,
              }
            : current,
        );
      }
      setGlobalConfirmed(false);
      await refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === "conflict") {
        setConflict(error.message);
      } else {
        setMessage(describeError(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft() {
    if (!token || !draft || draft.mode !== "existing" || !draft.version || busy) {
      return;
    }
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (draft.scope === "global" && !globalConfirmed) {
      setMessage("Confirme a remoção no escopo global.");
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await studioApi.mutate(token, {
        provider: PROVIDER,
        action: "delete",
        scope: draft.scope,
        kind: draft.kind,
        name: draft.name,
        expectedVersion: draft.version,
      });
      setMessage(
        `Recurso removido. Backup: ${response.report.backup?.id ?? "não aplicável"}.`,
      );
      setDraft(null);
      setConfirmDelete(false);
      setGlobalConfirmed(false);
      await refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === "conflict") {
        setConflict(error.message);
      } else {
        setMessage(describeError(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function reloadAfterConflict() {
    setConflict(null);
    if (draft && draft.mode === "existing") {
      await openResource({
        id: draft.name,
        provider: PROVIDER,
        kind: draft.kind,
        scope: draft.scope,
        name: draft.name,
        version: draft.version ?? "",
        valid: true,
        diagnostics: [],
      });
    }
  }

  if (connection.status === "loading") {
    return <p className="text-sm text-zinc-500">Carregando sessão…</p>;
  }

  if (connection.status === "disconnected") {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/40">
        <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
          Desconectado
        </h2>
        <p className="text-sm text-amber-800 dark:text-amber-300">
          Nenhuma sessão ativa. Inicie o Blipo Studio pela CLI, que fixa o workspace e gera o token
          local:
        </p>
        <pre className="rounded bg-zinc-900 p-3 text-xs text-zinc-100">blipo start</pre>
        <p className="text-sm text-amber-800 dark:text-amber-300">
          O navegador é aberto automaticamente com o token no fragmento da URL. Sem a CLI, o acesso
          ao disco permanece bloqueado (fail-closed).
        </p>
        {listError ? <p className="text-sm text-red-700">{listError}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
          Sessão ativa
        </h2>
        <dl className="mt-2 grid gap-1 text-zinc-600 dark:text-zinc-400">
          <div className="flex gap-2">
            <dt className="font-medium">Workspace:</dt>
            <dd className="break-all font-mono text-xs">{connection.session.workspace}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Backups:</dt>
            <dd className="break-all font-mono text-xs">{connection.session.backupRoot}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-medium">Origem:</dt>
            <dd className="font-mono text-xs">{connection.session.origin}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-zinc-500">
          Backups são obrigatórios antes de atualizar/remover e não expiram. Agentes e subagentes
          compartilham a pasta <code>agents/</code>; skills usam <code>skills/&lt;nome&gt;/SKILL.md</code>.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Provider</span>
            <select
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
              value={PROVIDER}
              disabled
            >
              <option value="opencode">OpenCode</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Escopo</span>
            <select
              aria-label="Filtrar por escopo"
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
              value={scopeFilter}
              onChange={(event) => {
                const value = event.target.value;
                setScopeFilter(value);
                void loadFor(value);
              }}
            >
              <option value="all">Todos</option>
              <option value="global">Global</option>
              <option value="repository">Repositório</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Tipo</span>
            <select
              aria-label="Filtrar por tipo"
              className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
              value={kindFilter}
              onChange={(event) => setKindFilter(event.target.value)}
            >
              <option value="all">Todos</option>
              <option value="agent">Agente</option>
              <option value="subagent">Subagente</option>
              <option value="skill">Skill</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={busy}
            className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Atualizar
          </button>
        </div>

        {listError ? <p className="text-sm text-red-700">{listError}</p> : null}

        {scanDiagnostics.length > 0 ? (
          <ul className="flex flex-col gap-1 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {scanDiagnostics.map((diagnostic, index) => (
              <li key={`${diagnostic.code}-${index}`}>
                [{diagnostic.code}] {diagnostic.path}: {diagnostic.message}
              </li>
            ))}
          </ul>
        ) : null}

        <ul className="flex flex-col divide-y divide-zinc-200 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {filtered.length === 0 ? (
            <li className="p-4 text-sm text-zinc-500">Nenhum recurso encontrado.</li>
          ) : (
            filtered.map((resource) => (
              <li key={resource.id} className="flex items-center justify-between gap-3 p-3">
                <button
                  type="button"
                  onClick={() => void selectResource(resource)}
                  className="flex flex-1 flex-col items-start text-left"
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {resource.name}
                    {resource.mode ? (
                      <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        mode: {resource.mode}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {KIND_LABEL[resource.kind]} · {SCOPE_LABEL[resource.scope]}
                    {resource.description ? ` · ${resource.description}` : ""}
                  </span>
                </button>
                {resource.valid ? (
                  <span className="text-xs text-emerald-600">válido</span>
                ) : (
                  <span className="text-xs text-red-600">inválido</span>
                )}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
          Criar recurso
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Tipo</span>
            <select
              aria-label="Tipo do novo recurso"
              className="rounded border border-zinc-300 bg-white px-2 py-1 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
              disabled={busy}
              value={newKind}
              onChange={(event) => setNewKind(event.target.value as ResourceKind)}
            >
              <option value="agent">Agente primário</option>
              <option value="subagent">Subagente</option>
              <option value="skill">Skill</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Escopo</span>
            <select
              aria-label="Escopo do novo recurso"
              className="rounded border border-zinc-300 bg-white px-2 py-1 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
              disabled={busy}
              value={newScope}
              onChange={(event) => setNewScope(event.target.value as Scope)}
            >
              <option value="repository">Repositório</option>
              <option value="global">Global</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Nome (a-z, 0-9, hífen)</span>
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
              disabled={busy}
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">Descrição</span>
            <input
              className="rounded border border-zinc-300 bg-white px-2 py-1 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
              disabled={busy}
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value)}
            />
          </label>
        </div>
        <div>
          <button
            type="button"
            onClick={() => void generateTemplate()}
            disabled={busy || newName.length === 0 || newDescription.length === 0}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
          >
            Gerar template
          </button>
        </div>
      </section>

      {draft ? (
        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
              {draft.mode === "new" ? "Novo" : "Editar"} {KIND_LABEL[draft.kind]} · {draft.name} ·{" "}
              {SCOPE_LABEL[draft.scope]}
            </h2>
            {dirty ? (
              <span className="text-xs text-amber-600">alterações não salvas</span>
            ) : null}
          </div>

          {conflict ? (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
            >
              <p>
                Conflito: {conflict} Seu rascunho foi mantido.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void reloadAfterConflict()}
                  className="rounded bg-red-700 px-3 py-1 text-xs text-white"
                >
                  Reler e descartar rascunho
                </button>
                <button
                  type="button"
                  onClick={() => setConflict(null)}
                  className="rounded border border-red-400 px-3 py-1 text-xs"
                >
                  Manter rascunho
                </button>
              </div>
            </div>
          ) : null}

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              Conteúdo RAW (frontmatter e corpo, exatamente como será gravado)
            </span>
            <textarea
              aria-label="Conteúdo RAW do recurso"
              className="h-72 w-full rounded border border-zinc-300 bg-zinc-50 p-3 font-mono text-xs disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900"
              disabled={busy}
              value={draft.content}
              onChange={(event) =>
                setDraft((current) => (current ? { ...current, content: event.target.value } : current))
              }
            />
          </label>

          {draft.scope === "global" ? (
            <label className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
              <input
                type="checkbox"
                checked={globalConfirmed}
                onChange={(event) => setGlobalConfirmed(event.target.checked)}
              />
              Confirmo que vou alterar a configuração global do usuário.
            </label>
          ) : null}

          {draft.validationOk === false ? (
            <ul className="flex flex-col gap-1 rounded border border-red-300 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {draft.diagnostics.map((diagnostic, index) => (
                <li key={`${diagnostic.code}-${index}`}>
                  [{diagnostic.severity}] {diagnostic.message}
                </li>
              ))}
            </ul>
          ) : null}

          {draft.validationOk === true ? (
            <p className="text-sm text-emerald-600">Validação concluída sem erros.</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void validateDraft()}
              disabled={busy || draft.mode === "new"}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
            >
              Validar
            </button>
            <button
              type="button"
              onClick={() => setShowDiff((value) => !value)}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
            >
              {showDiff ? "Ocultar prévia" : "Prévia de alterações"}
            </button>
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={busy || (draft.scope === "global" && !globalConfirmed)}
              className="rounded bg-emerald-700 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {draft.mode === "new" ? "Salvar (criar)" : "Salvar (atualizar)"}
            </button>
            {draft.mode === "existing" ? (
              <button
                type="button"
                onClick={() => void deleteDraft()}
                disabled={busy || (draft.scope === "global" && !globalConfirmed)}
                className="rounded border border-red-400 px-3 py-1.5 text-sm text-red-700 disabled:opacity-50"
              >
                {confirmDelete ? "Confirmar remoção" : "Remover"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setConfirmDelete(false);
                setConflict(null);
              }}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
            >
              Cancelar
            </button>
          </div>

          {showDiff ? (
            <div className="max-h-64 overflow-auto rounded border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs dark:border-zinc-800 dark:bg-zinc-900">
              {diffLines(draft.original, draft.content).map((line, index) => (
                <div
                  key={index}
                  className={
                    line.type === "added"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : line.type === "removed"
                        ? "text-red-700 dark:text-red-400"
                        : "text-zinc-500"
                  }
                >
                  {line.type === "added" ? "+ " : line.type === "removed" ? "- " : "  "}
                  {line.text}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {message ? (
        <p role="status" className="text-sm text-zinc-700 dark:text-zinc-300">
          {message}
        </p>
      ) : null}
    </div>
  );
}
