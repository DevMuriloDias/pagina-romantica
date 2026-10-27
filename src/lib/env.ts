import "server-only";
import { z } from "zod";

const bool = z
  .string()
  .optional()
  .transform((v) => v === "1" || v === "true");

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_SECRET: z.string().min(32, "APP_SECRET precisa de pelo menos 32 caracteres"),
  DATABASE_URL: z.string().min(1),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),

  PAYMENTS_PROVIDER: z.enum(["mercadopago", "mock"]).default("mock"),
  MP_ACCESS_TOKEN: z.string().optional(),
  NEXT_PUBLIC_MP_PUBLIC_KEY: z.string().optional(),
  MP_WEBHOOK_SECRET: z.string().optional(),
  PIX_EXPIRATION_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  CARD_MAX_INSTALLMENTS: z.coerce.number().int().min(1).max(12).default(12),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Amor em Página <onboarding@resend.dev>"),
  EMAIL_REPLY_TO: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default("claude-sonnet-5-5"),
  AI_MAX_PER_DRAFT: z.coerce.number().int().min(0).default(30),
  AI_MAX_PER_IP: z.coerce.number().int().min(0).default(60),
  AI_SERVER_FALLBACK: bool,

  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  NOMINATIM_USER_AGENT: z.string().default("AmorEmPagina/1.0"),

  CRON_SECRET: z.string().optional(),
  DRAFT_RETENTION_DAYS: z.coerce.number().int().min(1).default(30),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

/** Lê e valida as variáveis de ambiente (lazy, para não quebrar o build). */
export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(
    Object.fromEntries(Object.entries(process.env).map(([k, v]) => [k, v === "" ? undefined : v])),
  );
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export function appUrl(path = ""): string {
  return `${env().APP_URL.replace(/\/$/, "")}${path}`;
}
