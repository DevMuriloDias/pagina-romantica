import { SECTION_DATA, type Section, type SectionData, type SectionType } from "../content/schema";
import { uid } from "../utils";

/**
 * Registro tipado dos módulos da página.
 * Para criar um novo módulo:
 *  1. adicione o schema em SECTION_DATA (content/schema.ts);
 *  2. adicione os metadados aqui;
 *  3. implemente o renderer em src/components/page/sections e registre em renderers.tsx;
 *  4. implemente o editor em src/components/builder/editors e registre em editors/index.tsx.
 * O TypeScript acusa erro se algum dos mapas ficar incompleto.
 */
export interface SectionMeta<T extends SectionType> {
  type: T;
  label: string;
  description: string;
  emoji: string;
  /** Recurso exige plano Premium (ver PlanLimits.premiumSections no banco). */
  premiumHint: boolean;
  /** Quantas vezes pode aparecer na página. */
  maxInstances: number;
  /** Seções obrigatórias não podem ser removidas (só ocultadas). */
  removable: boolean;
  defaults: () => SectionData<T>;
}

type Registry = { [K in SectionType]: SectionMeta<K> };

export const sectionRegistry: Registry = {
  hero: {
    type: "hero",
    label: "Capa",
    description: "Título e subtítulo que abrem a página.",
    emoji: "💖",
    premiumHint: false,
    maxInstances: 1,
    removable: false,
    defaults: () => ({ title: "Para você, meu amor", subtitle: "Uma página feita com todo o meu carinho", layout: "centered" }),
  },
  letters: {
    type: "letters",
    label: "Cartinhas",
    description: "Cartas em envelopes que abrem com um clique.",
    emoji: "💌",
    premiumHint: false,
    maxInstances: 1,
    removable: true,
    defaults: () => ({ title: "Cartinhas para você", letters: [] }),
  },
  photos: {
    type: "photos",
    label: "Fotos do casal",
    description: "Polaroids, carrossel, grade, slideshow, filme ou livro.",
    emoji: "📸",
    premiumHint: false,
    maxInstances: 3,
    removable: true,
    defaults: () => ({ title: "Nossos momentos", layout: "polaroid", photos: [] }),
  },
  timeline: {
    type: "timeline",
    label: "Linha do tempo",
    description: "As datas mais importantes da história de vocês.",
    emoji: "🗓️",
    premiumHint: false,
    maxInstances: 1,
    removable: true,
    defaults: () => ({ title: "Nossa história", layout: "vertical", events: [] }),
  },
  places: {
    type: "places",
    label: "Nossos lugares",
    description: "Mapa com os lugares especiais de vocês.",
    emoji: "📍",
    premiumHint: false,
    maxInstances: 1,
    removable: true,
    defaults: () => ({ title: "Lugares que são nossos", layout: "map", places: [] }),
  },
  counter: {
    type: "counter",
    label: "Juntos há...",
    description: "Contador ao vivo do tempo que vocês estão juntos.",
    emoji: "⏳",
    premiumHint: false,
    maxInstances: 1,
    removable: true,
    defaults: () => ({ title: "Juntos há", startDate: "", style: "flip" }),
  },
  countdown: {
    type: "countdown",
    label: "Contagem regressiva",
    description: "Quanto falta para o próximo grande momento.",
    emoji: "🚀",
    premiumHint: false,
    maxInstances: 2,
    removable: true,
    defaults: () => ({ title: "Falta pouco", eventName: "Nossa próxima viagem", targetDate: "", style: "minimal", doneMessage: "Chegou o grande dia! 🎉" }),
  },
  reasons: {
    type: "reasons",
    label: "Motivos pelos quais te amo",
    description: "Cartões que viram ou um potinho de bilhetes.",
    emoji: "🫙",
    premiumHint: false,
    maxInstances: 1,
    removable: true,
    defaults: () => ({ title: "Motivos pelos quais eu te amo", layout: "flip", reasons: [] }),
  },
  sky: {
    type: "sky",
    label: "Céu da nossa data",
    description: "O céu estrelado do dia e da cidade especiais.",
    emoji: "✨",
    premiumHint: true,
    maxInstances: 1,
    removable: true,
    defaults: () => ({ title: "O céu daquela noite", date: "", time: "21:00", city: "", lat: null, lng: null, caption: "As estrelas estavam exatamente assim quando tudo começou.", showConstellations: true }),
  },
  quiz: {
    type: "quiz",
    label: "Quiz do casal",
    description: "Perguntas divertidas sobre vocês dois.",
    emoji: "🧩",
    premiumHint: true,
    maxInstances: 1,
    removable: true,
    defaults: () => ({ title: "Quanto você me conhece?", questions: [], resultHigh: "Você me conhece melhor do que ninguém! 💯", resultMid: "Quase perfeito — vamos criar mais memórias juntos 😄", resultLow: "Temos muito para descobrir um sobre o outro ainda 💕" }),
  },
  scratch: {
    type: "scratch",
    label: "Raspadinha",
    description: "Uma surpresa escondida para raspar com o dedo.",
    emoji: "🪙",
    premiumHint: true,
    maxInstances: 2,
    removable: true,
    defaults: () => ({ title: "Raspe para descobrir", instructions: "Passe o dedo para revelar a surpresa", hiddenType: "text", hiddenText: "Eu te amo mais do que tudo! 💖" }),
  },
  coupons: {
    type: "coupons",
    label: "Vale-presentes",
    description: "Cupons do amor para resgatar quando quiser.",
    emoji: "🎟️",
    premiumHint: true,
    maxInstances: 1,
    removable: true,
    defaults: () => ({
      title: "Vales do amor",
      coupons: [
        { id: uid("c"), title: "Vale 1 massagem", description: "Válido a qualquer hora, sem reclamar.", emoji: "💆" },
        { id: uid("c"), title: "Vale um jantar", description: "Você escolhe o lugar.", emoji: "🍝" },
        { id: uid("c"), title: "Vale um abraço demorado", description: "Daqueles que fazem o mundo parar.", emoji: "🤗" },
      ],
    }),
  },
  proposal: {
    type: "proposal",
    label: "Pedido especial",
    description: "Pedido de namoro ou casamento com botões Sim e Não.",
    emoji: "💍",
    premiumHint: true,
    maxInstances: 1,
    removable: true,
    defaults: () => ({ kind: "namoro", question: "Quer namorar comigo?", yesLabel: "Sim! 💖", noLabel: "Não", yesMessage: "Você acabou de me fazer a pessoa mais feliz do mundo!" }),
  },
  video: {
    type: "video",
    label: "Vídeo",
    description: "Uma mensagem gravada (YouTube).",
    emoji: "🎬",
    premiumHint: true,
    maxInstances: 2,
    removable: true,
    defaults: () => ({ title: "Um recado em vídeo", url: "", caption: "" }),
  },
  finale: {
    type: "finale",
    label: "Frase final",
    description: "Uma última frase com assinatura escrita à mão.",
    emoji: "🖋️",
    premiumHint: false,
    maxInstances: 1,
    removable: true,
    defaults: () => ({ phrase: "Hoje, amanhã e sempre: é você.", signature: "" }),
  },
  guestbook: {
    type: "guestbook",
    label: "Deixe um recado",
    description: "Seu amor pode responder — só você vê.",
    emoji: "📝",
    premiumHint: true,
    maxInstances: 1,
    removable: true,
    defaults: () => ({ title: "Deixe um recadinho", prompt: "Escreva algo só para mim 💌" }),
  },
};

export const SECTION_ORDER: SectionType[] = [
  "hero",
  "counter",
  "letters",
  "photos",
  "timeline",
  "places",
  "reasons",
  "sky",
  "countdown",
  "quiz",
  "scratch",
  "coupons",
  "video",
  "proposal",
  "guestbook",
  "finale",
];

export function createSection<T extends SectionType>(type: T, data?: Partial<SectionData<T>>): Section {
  const meta = sectionRegistry[type] as SectionMeta<T>;
  const merged = { ...meta.defaults(), ...(data ?? {}) };
  return {
    id: uid(`${type.slice(0, 3)}-`),
    type,
    visible: true,
    style: { bgType: "inherit", spacing: "normal", animation: "inherit" },
    data: SECTION_DATA[type].parse(merged),
  } as Section;
}
