import "server-only";
import { render } from "@react-email/components";
import type { Prisma } from "@prisma/client";
import { createElement, type ComponentType } from "react";
import { Resend } from "resend";
import { EMAIL_TEMPLATES, type EmailProps, type EmailTemplateName } from "@/emails/templates";
import { db } from "./db";
import { env } from "./env";
import { log } from "./log";

let resend: Resend | null = null;
function client(): Resend | null {
  const key = env().RESEND_API_KEY;
  if (!key) return null;
  resend ??= new Resend(key);
  return resend;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const MAX_EMAIL_ATTEMPTS = 6;

async function deliver(logId: string): Promise<boolean> {
  const entry = await db.emailLog.findUnique({ where: { id: logId } });
  if (!entry || entry.status === "SENT") return true;
  const tpl = EMAIL_TEMPLATES[entry.template as EmailTemplateName];
  if (!tpl) throw new Error(`Template desconhecido: ${entry.template}`);
  const html = await render(createElement(tpl.component as ComponentType<Record<string, unknown>>, entry.props as Record<string, unknown>));
  const text = await render(createElement(tpl.component as ComponentType<Record<string, unknown>>, entry.props as Record<string, unknown>), { plainText: true });
  const c = client();
  await db.emailLog.update({ where: { id: logId }, data: { attempts: { increment: 1 } } });
  if (!c) {
    // Modo desenvolvimento: sem Resend, apenas registra (o E2E lê o EmailLog).
    log.info("email.dev_outbox", { to: entry.to, subject: entry.subject, template: entry.template });
    await db.emailLog.update({ where: { id: logId }, data: { status: "SENT", providerId: "dev-outbox", error: null } });
    return true;
  }
  const { data, error } = await c.emails.send({
    from: env().EMAIL_FROM,
    to: entry.to,
    replyTo: env().EMAIL_REPLY_TO,
    subject: entry.subject,
    html,
    text,
  });
  if (error) {
    await db.emailLog.update({ where: { id: logId }, data: { status: "FAILED", error: `${error.name}: ${error.message}` } });
    return false;
  }
  await db.emailLog.update({ where: { id: logId }, data: { status: "SENT", providerId: data?.id ?? null, error: null } });
  return true;
}

/**
 * Envia um e-mail transacional com registro (EmailLog) e retentativas.
 * Falhas persistentes ficam como FAILED e o cron /api/cron/emails tenta de novo.
 */
export async function sendEmail<T extends EmailTemplateName>(
  template: T,
  to: string,
  props: EmailProps<T>,
  meta: { pageId?: string; orderId?: string } = {},
): Promise<{ id: string; sent: boolean }> {
  const tpl = EMAIL_TEMPLATES[template];
  const entry = await db.emailLog.create({
    data: {
      to,
      template,
      subject: (tpl.subject as (p: unknown) => string)(props),
      props: props as unknown as Prisma.InputJsonValue,
      pageId: meta.pageId,
      orderId: meta.orderId,
    },
  });
  const sent = await retryDelivery(entry.id, 3);
  return { id: entry.id, sent };
}

export async function retryDelivery(logId: string, attempts: number): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    try {
      if (await deliver(logId)) return true;
    } catch (err) {
      log.error("email.send_error", { logId, err });
      await db.emailLog.update({ where: { id: logId }, data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) } }).catch(() => {});
    }
    if (i < attempts - 1) await sleep(300 * 3 ** i);
  }
  return false;
}
