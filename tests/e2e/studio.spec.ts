import { expect, test } from "@playwright/test";

const port = process.env.BLIPO_E2E_PORT ?? "4599";
const token = process.env.BLIPO_E2E_TOKEN ?? "e2e".repeat(16);
const baseURL = `http://127.0.0.1:${port}`;

const NAME = "e2e-agent";

test("cria, edita, trata conflito e remove um agente sem tocar config real", async ({
  page,
  request,
}) => {
  await page.goto(`${baseURL}/#token=${token}`);

  await expect(page.getByText("Sessão ativa")).toBeVisible();

  await page.getByLabel("Tipo do novo recurso").selectOption("agent");
  await page.getByLabel("Nome (a-z, 0-9, hífen)").fill(NAME);
  await page.getByLabel("Descrição").fill("Agente criado no E2E");
  await page.getByRole("button", { name: "Gerar template" }).click();

  const editor = page.getByLabel("Conteúdo RAW do recurso");
  await expect(editor).toHaveValue(/mode: primary/);
  await page.getByRole("button", { name: "Salvar (criar)" }).click();
  await expect(page.getByText(/Recurso criado/)).toBeVisible();

  await page.getByRole("button", { name: new RegExp(NAME) }).first().click();
  await expect(page.getByRole("button", { name: "Salvar (atualizar)" })).toBeVisible();

  const readResponse = await request.post(`${baseURL}/api/resources/read`, {
    headers: { "x-blipo-token": token, origin: baseURL },
    data: { provider: "opencode", scope: "repository", kind: "agent", name: NAME },
  });
  expect(readResponse.ok()).toBe(true);
  const read = await readResponse.json();

  const externalUpdate = await request.post(`${baseURL}/api/resources/mutate`, {
    headers: { "x-blipo-token": token, origin: baseURL },
    data: {
      provider: "opencode",
      action: "update",
      scope: "repository",
      kind: "agent",
      name: NAME,
      content: `${read.raw}\n<!-- alteração externa -->\n`,
      expectedVersion: read.version,
    },
  });
  expect(externalUpdate.ok()).toBe(true);

  await editor.fill(`${read.raw}\n<!-- rascunho local -->\n`);
  await page.getByRole("button", { name: "Salvar (atualizar)" }).click();

  await expect(page.getByText(/Conflito:/)).toBeVisible();
  await expect(page.getByText(/rascunho foi mantido/)).toBeVisible();

  await page.getByRole("button", { name: "Reler e descartar rascunho" }).click();
  await expect(page.getByRole("button", { name: "Salvar (atualizar)" })).toBeVisible();

  await page.getByRole("button", { name: "Remover" }).click();
  await page.getByRole("button", { name: "Confirmar remoção" }).click();
  await expect(page.getByText(/Recurso removido/)).toBeVisible();
});

test("skill: cria e edita disable-model-invocation preservando false", async ({ page, request }) => {
  await page.goto(`${baseURL}/#token=${token}`);
  await expect(page.getByText("Sessão ativa")).toBeVisible();

  const name = "e2e-skill";
  await page.getByLabel("Tipo do novo recurso").selectOption("skill");
  await page.getByLabel("Nome (a-z, 0-9, hífen)").fill(name);
  await page.getByLabel("Descrição").fill("Skill criada no E2E");
  await page.getByLabel("disable-model-invocation do novo recurso").selectOption("false");
  await page.getByRole("button", { name: "Gerar template" }).click();

  const editor = page.getByLabel("Conteúdo RAW do recurso");
  await expect(editor).toHaveValue(/disable-model-invocation: false/);
  await page.getByRole("button", { name: "Salvar (criar)" }).click();
  await expect(page.getByText(/Recurso criado/)).toBeVisible();

  const readResponse = await request.post(`${baseURL}/api/resources/read`, {
    headers: { "x-blipo-token": token, origin: baseURL },
    data: { provider: "opencode", scope: "repository", kind: "skill", name },
  });
  expect(readResponse.ok()).toBe(true);
  const read = await readResponse.json();
  expect(read.resource.disableModelInvocation).toBe(false);

  await page.getByLabel("disable-model-invocation da skill").selectOption("true");
  await expect(editor).toHaveValue(/disable-model-invocation: true/);
  await page.getByRole("button", { name: "Salvar (atualizar)" }).click();
  await expect(page.getByText(/Recurso atualizado/)).toBeVisible();

  const updatedResponse = await request.post(`${baseURL}/api/resources/read`, {
    headers: { "x-blipo-token": token, origin: baseURL },
    data: { provider: "opencode", scope: "repository", kind: "skill", name },
  });
  const updated = await updatedResponse.json();
  expect(updated.resource.disableModelInvocation).toBe(true);
});

test("cancelar novo template preserva o rascunho atual", async ({ page }) => {
  await page.goto(`${baseURL}/#token=${token}`);
  await expect(page.getByText("Sessão ativa")).toBeVisible();

  await page.getByLabel("Tipo do novo recurso").selectOption("agent");
  await page.getByLabel("Nome (a-z, 0-9, hífen)").fill("keep-draft");
  await page.getByLabel("Descrição").fill("rascunho preservado");
  await page.getByRole("button", { name: "Gerar template" }).click();

  const editor = page.getByLabel("Conteúdo RAW do recurso");
  await editor.fill("---\ndescription: rascunho editado\nmode: primary\n---\ncorpo\n");

  page.on("dialog", (dialog) => {
    void dialog.dismiss();
  });
  await page.getByRole("button", { name: "Gerar template" }).click();

  await expect(editor).toHaveValue(/rascunho editado/);
});
