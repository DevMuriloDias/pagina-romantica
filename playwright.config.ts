import { defineConfig, devices } from "@playwright/test";

/**
 * E2E do fluxo principal. Requer Postgres (DATABASE_URL) e roda com PAYMENTS_PROVIDER=mock,
 * que percorre o MESMO caminho do webhook real (assinatura x-signature + busca do pagamento).
 */
const PORT = Number(process.env.E2E_PORT ?? 3000);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 860 } } },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { PAYMENTS_PROVIDER: "mock", STORAGE_DRIVER: "local", MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET ?? "dev-webhook-secret" },
  },
});
