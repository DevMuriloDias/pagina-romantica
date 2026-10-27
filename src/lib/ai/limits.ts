import "server-only";
import { ApiError, clientIp, enforceRate } from "../api";
import { db } from "../db";
import { env } from "../env";

/** Limites de IA: por rascunho (contador no banco) e por IP (janela de 24h). */
export async function consumeAiQuota(pageId: string) {
  const { AI_MAX_PER_DRAFT, AI_MAX_PER_IP } = env();
  const ip = await clientIp();
  await enforceRate("ai-ip", ip, AI_MAX_PER_IP, 86_400, "Você atingiu o limite diário de uso da IA. Tente de novo amanhã ou escreva com suas palavras 💕");
  const updated = await db.page.updateMany({
    where: { id: pageId, aiGenerations: { lt: AI_MAX_PER_DRAFT } },
    data: { aiGenerations: { increment: 1 } },
  });
  if (updated.count === 0) throw new ApiError(429, "Esta página atingiu o limite de usos da IA. Você ainda pode editar tudo à mão.", "ai_limit");
}
