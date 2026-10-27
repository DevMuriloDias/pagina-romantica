import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1366, height: 860 } });

/** Regressões: janelas (porta, carta aberta) aparecem na área visível do preview e a porta valida a resposta. */
test("preview: carta abre na área visível e a tela de entrada pode ser testada", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "fluxo do editor no desktop");
  const { pageId } = await (await page.request.post("/api/drafts")).json();
  await page.request.post(`/api/pages/${pageId}/generate`, { data: { senderName: "Lu", recipientName: "Ma", relationship: "namoro", templateId: "classico" } });
  await page.goto(`/criar/editor?page=${pageId}`);
  const preview = page.getByRole("region", { name: "Prévia da página" });
  const screen = page.locator("[data-preview-scroller]");

  // Carta: rola até o envelope (meio da página) e abre — a carta precisa estar visível na tela
  const envelope = screen.getByRole("button", { name: /Abrir carta/ }).first();
  await envelope.scrollIntoViewIfNeeded();
  await envelope.click();
  const letter = preview.getByRole("dialog");
  await expect(letter).toBeInViewport();
  await page.keyboard.press("Escape");

  // Tela de entrada com pergunta secreta
  await page.getByRole("tab", { name: "Entrada" }).click();
  await page.getByRole("radio", { name: /Pergunta secreta/ }).click();
  await page.getByLabel("Resposta 1").fill("Praia do Forte");
  await page.getByRole("button", { name: /Salvar respostas/ }).click();
  await expect(page.getByText(/resposta\(s\) salva/)).toBeVisible();
  await page.getByRole("button", { name: /Ver e testar/ }).click();

  const answer = preview.locator("#gate-answer");
  await expect(answer).toBeInViewport();
  const submit = preview.locator("form:has(#gate-answer) button[type=submit]");
  await answer.fill("montanha");
  await submit.click();
  await expect(preview.getByRole("alert")).toContainText("não foi");
  await answer.fill("  PRAIA do forte ");
  await submit.click();
  await expect(answer).toHaveCount(0);
});
