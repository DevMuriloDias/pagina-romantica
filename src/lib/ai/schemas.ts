import { z } from "zod";

const s = (max: number) => z.string().trim().min(1).max(max);

export const AiDraftSchema = z.object({
  title: s(120),
  subtitle: s(240),
  mainLetter: z.object({ title: s(120), body: s(6000), signature: s(80) }),
  extraLetters: z.array(z.object({ openWhen: s(80), title: s(120), body: s(3000) })).max(4).default([]),
  reasons: z.array(s(240)).min(1).max(20),
  photoCaptions: z.array(s(200)).max(10).default([]),
  timeline: z.array(z.object({ title: s(120), description: z.string().max(1000).default(""), emoji: z.string().max(16).default("💞") })).max(8).default([]),
  quiz: z
    .array(z.object({ question: s(200), options: z.array(s(120)).min(2).max(4), correctIndex: z.number().int().min(0).max(3) }))
    .max(6)
    .default([])
    .transform((qs) => qs.filter((q) => q.correctIndex < q.options.length)),
  finalePhrase: s(400),
  templateId: z.string().max(40).optional(),
});
export type AiDraft = z.infer<typeof AiDraftSchema>;

export const RefusalSchema = z.object({ refused: z.literal(true), reason: z.string().optional() });

export const StringListSchema = z.object({ items: z.array(s(240)).min(1).max(30) });
export const QuizListSchema = z.object({
  items: z
    .array(z.object({ question: s(200), options: z.array(s(120)).min(2).max(4), correctIndex: z.number().int().min(0).max(3) }))
    .min(1)
    .max(10),
});
