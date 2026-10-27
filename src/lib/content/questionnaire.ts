import { z } from "zod";
import { OCCASIONS, RELATIONSHIPS, TONES } from "./schema";

export const QuestionnaireSchema = z.object({
  senderName: z.string().trim().max(60).default(""),
  recipientName: z.string().trim().max(60).default(""),
  relationship: z.enum(RELATIONSHIPS).default("namoro"),
  occasion: z.enum(OCCASIONS).default("so_porque_sim"),
  startDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).default(""),
  howWeMet: z.string().trim().max(600).default(""),
  memories: z.array(z.string().trim().max(400)).max(3).default([]),
  lovedThings: z.string().trim().max(800).default(""),
  insideJokes: z.string().trim().max(500).default(""),
  tone: z.enum(TONES).default("romantico"),
  templateId: z.string().max(40).default("classico"),
});
export type Questionnaire = z.infer<typeof QuestionnaireSchema>;

export const RELATIONSHIP_LABELS: Record<(typeof RELATIONSHIPS)[number], string> = {
  namoro: "Namoro",
  noivado: "Noivado",
  casamento: "Casamento",
  ficante: "Ficante",
  pedido_namoro: "Pedido de namoro",
  pedido_casamento: "Pedido de casamento",
  aniversario_namoro: "Aniversário de namoro",
  reconciliacao: "Reconciliação",
  amizade_colorida: "Amizade colorida",
  outro: "Outro",
};

export const OCCASION_LABELS: Record<(typeof OCCASIONS)[number], string> = {
  aniversario: "Aniversário dele(a)",
  dia_dos_namorados: "Dia dos Namorados",
  mesversario: "Mêsversário",
  bodas: "Bodas",
  so_porque_sim: "Só porque sim",
  pedido: "Pedido",
};

export const TONE_LABELS: Record<(typeof TONES)[number], { label: string; emoji: string; hint: string }> = {
  romantico: { label: "Romântico", emoji: "🌹", hint: "Clássico, carinhoso e intenso" },
  poetico: { label: "Poético", emoji: "🪶", hint: "Metáforas e delicadeza" },
  divertido: { label: "Divertido", emoji: "😂", hint: "Leve, com humor e piadas internas" },
  fofo: { label: "Fofo", emoji: "🧸", hint: "Doce, meigo e cheio de apelidos" },
  emocionante: { label: "Emocionante", emoji: "🥹", hint: "De dar nó na garganta" },
  picante_leve: { label: "Picante leve", emoji: "🌶️", hint: "Provocante, sem nada explícito" },
};
