import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

const db = new PrismaClient();
test.afterAll(() => db.$disconnect());

/**
 * Fluxo: questionário → editar → pagar com Pix (sandbox simulado) → link liberado na tela → e-mail enviado.
 */
test("cliente cria, paga com Pix e recebe o link", async ({ page }, info) => {
  const email = `e2e-${info.project.name}-${Date.now()}@teste.com`;
  const recipient = `Marina ${info.project.name}`;

  // 1. Questionário
  await page.goto("/criar?novo=1");
  await page.getByPlaceholder("Ex.: Lucas").fill("Lucas");
  await page.getByPlaceholder(/Ex\.: Marina/).fill(recipient);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("radio", { name: /Namoro/ }).first().click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("radio", { name: /Aniversário dele/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Data").fill("2021-06-12");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByPlaceholder("Foi assim...").fill("Num show de rock, dividindo um guarda-chuva.");
  // pula as demais perguntas
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Pular" }).click();
  await page.getByRole("button", { name: /Criar minha página/ }).click();

  // 2. Geração (IA ou textos padrão) → editor
  await expect(page.getByText("Criando sua página...")).toBeVisible();
  await page.waitForURL(/\/criar\/editor\?page=/, { timeout: 30_000 });
  const pageId = new URL(page.url()).searchParams.get("page")!;

  // Mobile: alterna para "Ver"; desktop: a prévia já está visível
  const preview = page.getByRole("region", { name: "Prévia da página" });
  if (info.project.name === "mobile") await page.getByRole("button", { name: "Ver" }).click();
  await expect(preview.getByText(recipient).first()).toBeVisible();
  if (info.project.name === "mobile") await page.getByRole("button", { name: "Editar" }).click();

  // 3. Edita o título da capa e confere o autosave + preview ao vivo
  await page.locator("[data-section-row=hero] button[aria-expanded]").click();
  const title = page.getByLabel("Título").first();
  await title.fill(`Te amo, ${recipient}!`);
  await expect(page.getByTestId("saved")).toBeVisible({ timeout: 15_000 });
  const saved = await db.page.findUniqueOrThrow({ where: { id: pageId } });
  expect(JSON.stringify(saved.content)).toContain(`Te amo, ${recipient}!`);

  // 4. Revisão → checkout
  await page.getByRole("link", { name: /finalizar/i }).click();
  await expect(page.getByRole("button", { name: /Revisão final/ })).toBeVisible();
  await page.getByRole("link", { name: /Finalizar/ }).click();
  await expect(page.getByRole("heading", { name: "Finalizar sua página" })).toBeVisible();
  await expect(page.getByTestId("total")).toContainText("R$");

  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Confirme o e-mail").fill(email);
  await page.getByRole("checkbox").check();

  // 5. Pix
  await page.getByTestId("pay-pix").click();
  await expect(page.getByTestId("pix-panel")).toBeVisible();
  await expect(page.getByTestId("pix-code")).toContainText("br.gov.bcb.pix");

  // Simula o pagamento no "banco": dispara o webhook assinado (mesmo caminho do Mercado Pago)
  await page.getByTestId("mock-approve").click();

  // 6. A tela atualiza sozinha (SSE) e mostra o link
  await expect(page.getByTestId("success")).toBeVisible({ timeout: 30_000 });
  const publicUrl = (await page.getByTestId("public-url").textContent())!.trim();
  expect(publicUrl).toMatch(/\/p\/lucas-e-marina-[a-z0-9-]+-[a-z2-9]{8}$/);

  // 7. E-mail de aprovação enviado (registrado no EmailLog)
  await expect
    .poll(async () => (await db.emailLog.findFirst({ where: { to: email, template: "payment_approved" } }))?.status, { timeout: 15_000 })
    .toBe("SENT");
  const order = await db.order.findFirstOrThrow({ where: { pageId }, orderBy: { createdAt: "desc" } });
  expect(order.status).toBe("APPROVED");
  const event = await db.paymentEvent.findFirst({ where: { dataId: order.mpPaymentId! }, orderBy: { createdAt: "desc" } });
  expect(event?.signatureValid).toBe(true);

  // 8. A página pública abre com a tela de entrada
  await page.goto(new URL(publicUrl).pathname);
  await page.getByRole("button", { name: "Abrir 💌", exact: true }).click();
  await expect(page.getByRole("heading", { name: `Te amo, ${recipient}!` })).toBeVisible();
});

test("página não paga não é pública", async ({ request }) => {
  const res = await request.get("/p/nao-existe-abcdefgh");
  expect(res.status()).toBe(404);
});
