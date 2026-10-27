import bcrypt from "bcryptjs";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { normalizeAnswer, normalizePassword } from "@/lib/gate";
import { requireEditablePage } from "@/lib/pages/access";
import { pageView } from "@/lib/pages/service";

type Ctx = { params: Promise<{ id: string }> };

const Schema = z.object({
  mode: z.enum(["none", "password", "question"]),
  answers: z.array(z.string().trim().min(1).max(120)).max(10).default([]),
});

/** Salva as respostas aceitas da tela de entrada como hash bcrypt (nunca em texto puro). */
export const PUT = route(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const page = await requireEditablePage(id);
  const { mode, answers } = await parseBody(req, Schema);
  const normalize = mode === "password" ? normalizePassword : normalizeAnswer;
  const normalized = [...new Set(answers.map(normalize).filter(Boolean))];
  if (mode !== "none" && normalized.length === 0) throw new ApiError(400, "Cadastre pelo menos uma resposta.", "no_answers");
  const hashes = mode === "none" ? [] : await Promise.all(normalized.map((a) => bcrypt.hash(a, 10)));
  const { content } = pageView(page);
  content.gate.mode = mode;
  content.gate.answersCount = hashes.length;
  await db.page.update({ where: { id }, data: { gateHashes: hashes, content: content as unknown as Prisma.InputJsonValue } });
  return json({ ok: true, answersCount: hashes.length });
});
