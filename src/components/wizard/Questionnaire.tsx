"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { api } from "@/lib/client/api";
import { OCCASION_LABELS, RELATIONSHIP_LABELS, TONE_LABELS, type Questionnaire as Answers } from "@/lib/content/questionnaire";
import { OCCASIONS, RELATIONSHIPS, TONES } from "@/lib/content/schema";
import { gradientCss } from "@/lib/theme/css";
import { fontStack, googleFontsUrl } from "@/lib/theme/fonts";
import type { TemplateDef } from "@/lib/theme/templates";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "aep_wizard_v1";

const EMPTY: Answers = {
  senderName: "",
  recipientName: "",
  relationship: "namoro",
  occasion: "so_porque_sim",
  startDate: "",
  howWeMet: "",
  memories: ["", "", ""],
  lovedThings: "",
  insideJokes: "",
  tone: "romantico",
  templateId: "classico",
};

type StepId = "names" | "relationship" | "occasion" | "startDate" | "howWeMet" | "memories" | "lovedThings" | "insideJokes" | "tone" | "template";
const STEPS: StepId[] = ["names", "relationship", "occasion", "startDate", "howWeMet", "memories", "lovedThings", "insideJokes", "tone", "template"];

const GENERATING = ["Lendo a história de vocês com carinho...", "Escolhendo as palavras certas...", "Escrevendo a carta principal...", "Separando os motivos pelos quais você ama...", "Montando a linha do tempo...", "Dando os últimos retoques ✨"];

export function Questionnaire({ templates, initialTemplate, existing }: { templates: TemplateDef[]; initialTemplate?: string; existing: { id: string; label: string } | null }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [answers, setAnswers] = useState<Answers>(() => ({ ...EMPTY, templateId: initialTemplate ?? EMPTY.templateId }));
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [choice, setChoice] = useState<"ask" | "new">(existing ? "ask" : "new");
  const [phase, setPhase] = useState<"form" | "generating">("form");
  const [genMsg, setGenMsg] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pageIdRef = useRef<string | null>(null);
  const fontsUrl = useMemo(() => googleFontsUrl(templates.flatMap((t) => [t.theme.fonts.heading, t.theme.fonts.script])), [templates]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { answers: Answers; step: number };
        setAnswers((a) => ({ ...a, ...parsed.answers, templateId: initialTemplate ?? parsed.answers.templateId }));
        setStep(Math.min(parsed.step ?? 0, STEPS.length - 1));
      }
    } catch {
      /* ignora */
    }
  }, [initialTemplate]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, step }));
    } catch {
      /* modo privado */
    }
  }, [answers, step]);

  useEffect(() => {
    if (phase !== "generating") return;
    const t = setInterval(() => setGenMsg((m) => (m + 1) % GENERATING.length), 2200);
    return () => clearInterval(t);
  }, [phase]);

  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setAnswers((a) => ({ ...a, [k]: v }));
  const id = STEPS[step]!;
  const go = (delta: number) => {
    setDir(delta);
    setStep((s) => Math.max(0, Math.min(STEPS.length - 1, s + delta)));
  };

  const ensureDraft = async () => {
    if (pageIdRef.current) return pageIdRef.current;
    const r = await api<{ pageId: string }>("/api/drafts", { method: "POST" });
    pageIdRef.current = r.pageId;
    return r.pageId;
  };

  const finish = async () => {
    setPhase("generating");
    setError(null);
    const started = Date.now();
    try {
      const pageId = await ensureDraft();
      await api(`/api/pages/${pageId}/generate`, { body: { ...answers, memories: answers.memories.filter((m) => m.trim()) } });
      const wait = Math.max(0, 2500 - (Date.now() - started));
      await new Promise((r) => setTimeout(r, wait));
      localStorage.removeItem(STORAGE_KEY);
      router.push(`/criar/editor?page=${pageId}`);
    } catch (err) {
      if (pageIdRef.current) {
        // O rascunho existe com textos padrão: seguimos para o editor (o fluxo nunca trava).
        router.push(`/criar/editor?page=${pageIdRef.current}`);
        return;
      }
      setError(err instanceof Error ? err.message : "Não foi possível criar sua página agora.");
      setPhase("form");
    }
  };

  const next = () => (step === STEPS.length - 1 ? void finish() : go(1));

  if (choice === "ask" && existing) {
    return (
      <Shell>
        <div className="mx-auto max-w-md text-center">
          <p className="text-5xl" aria-hidden>💌</p>
          <h1 className="mt-4 font-display text-3xl">Você tem uma página em andamento</h1>
          <p className="mt-2 text-ink-soft">{existing.label}</p>
          <div className="mt-8 flex flex-col gap-3">
            <Button size="lg" onClick={() => router.push(`/criar/editor?page=${existing.id}`)}>Continuar de onde parei</Button>
            <Button size="lg" variant="outline" onClick={() => setChoice("new")}>Começar uma página nova</Button>
          </div>
        </div>
      </Shell>
    );
  }

  if (phase === "generating") {
    return (
      <Shell hideProgress>
        <div className="mx-auto flex max-w-md flex-col items-center text-center" role="status" aria-live="polite">
          <div className="relative size-40">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute inset-0 rounded-full border-2 border-rose/40"
                animate={reduced ? undefined : { scale: [0.6, 1.4], opacity: [0.8, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8 }}
              />
            ))}
            <motion.div className="absolute inset-0 flex items-center justify-center text-7xl" animate={reduced ? undefined : { scale: [1, 1.15, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
              💖
            </motion.div>
          </div>
          <h1 className="mt-8 font-display text-3xl">Criando sua página...</h1>
          <AnimatePresence mode="wait">
            <motion.p key={genMsg} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mt-3 font-hand text-2xl text-rose">
              {GENERATING[genMsg]}
            </motion.p>
          </AnimatePresence>
          <p className="mt-6 text-sm text-ink-soft">Depois você pode mudar absolutamente tudo.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell progress={(step + 1) / STEPS.length} step={step + 1}>
      {fontsUrl ? <link rel="stylesheet" href={fontsUrl} precedence="default" /> : null}
      <form
        className="mx-auto w-full max-w-xl"
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={id}
            custom={dir}
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.3 }}
            className="min-h-[340px]"
          >
            <StepBody id={id} answers={answers} set={set} templates={templates} />
          </motion.div>
        </AnimatePresence>
        {error ? <Alert tone="danger" className="mt-4">{error}</Alert> : null}
        <div className="mt-8 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={() => go(-1)} disabled={step === 0}><ArrowLeft /> Voltar</Button>
          <div className="flex items-center gap-2">
            {step < STEPS.length - 1 ? <Button type="button" variant="ghost" onClick={() => go(1)}>Pular</Button> : null}
            <Button type="submit" size="lg">
              {step === STEPS.length - 1 ? "Criar minha página ✨" : "Continuar"} {step < STEPS.length - 1 ? <ArrowRight /> : null}
            </Button>
          </div>
        </div>
      </form>
    </Shell>
  );
}

function Shell({ children, progress, step, hideProgress }: { children: React.ReactNode; progress?: number; step?: number; hideProgress?: boolean }) {
  return (
    <div className="paper-grain flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-8">
        <Logo />
        {step ? <span className="text-sm text-ink-soft">{step} de {STEPS.length}</span> : null}
      </header>
      {!hideProgress && progress !== undefined ? (
        <div className="mx-4 h-1.5 overflow-hidden rounded-full bg-ink/10 sm:mx-8" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do questionário">
          <motion.div className="h-full rounded-full bg-rose" animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.4 }} />
        </div>
      ) : null}
      <main className="flex flex-1 items-center px-4 py-10 sm:px-8">{children}</main>
    </div>
  );
}

function Q({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-3xl leading-tight sm:text-4xl">{title}</h1>
      {hint ? <p className="mt-2 text-ink-soft">{hint}</p> : null}
    </div>
  );
}

function Chips<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; emoji?: string; hint?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("flex items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 text-left transition", value === o.value ? "border-rose shadow-[0_8px_24px_-14px_rgba(194,38,79,0.7)]" : "border-line hover:border-ink/25")}
        >
          {o.emoji ? <span className="text-2xl">{o.emoji}</span> : null}
          <span>
            <span className="block font-medium">{o.label}</span>
            {o.hint ? <span className="block text-xs text-ink-soft">{o.hint}</span> : null}
          </span>
        </button>
      ))}
    </div>
  );
}

const REL_EMOJI: Record<string, string> = { namoro: "💑", noivado: "💍", casamento: "👰", ficante: "😏", pedido_namoro: "💘", pedido_casamento: "💎", aniversario_namoro: "🎂", reconciliacao: "🤝", amizade_colorida: "🌈", outro: "✨" };
const OCC_EMOJI: Record<string, string> = { aniversario: "🎉", dia_dos_namorados: "🌹", mesversario: "📅", bodas: "🥂", so_porque_sim: "💖", pedido: "💍" };

function StepBody({ id, answers, set, templates }: { id: StepId; answers: Answers; set: <K extends keyof Answers>(k: K, v: Answers[K]) => void; templates: TemplateDef[] }) {
  const to = answers.recipientName || "seu amor";
  switch (id) {
    case "names":
      return (
        <>
          <Q title="Vamos começar pelos nomes 💕" hint="Pode ser apelido — do jeitinho que vocês se chamam." />
          <div className="space-y-4">
            <label className="block space-y-1.5"><span className="text-sm font-medium">Seu nome ou apelido</span><Input autoFocus value={answers.senderName} onChange={(e) => set("senderName", e.target.value)} placeholder="Ex.: Lucas" maxLength={60} className="h-12 text-lg" /></label>
            <label className="block space-y-1.5"><span className="text-sm font-medium">Nome ou apelido do seu amor</span><Input value={answers.recipientName} onChange={(e) => set("recipientName", e.target.value)} placeholder="Ex.: Marina, Mozão, Princesa..." maxLength={60} className="h-12 text-lg" /></label>
          </div>
        </>
      );
    case "relationship":
      return (
        <>
          <Q title={`O que vocês são, ${answers.senderName || "você"} e ${to}?`} />
          <Chips value={answers.relationship} onChange={(v) => set("relationship", v)} options={RELATIONSHIPS.map((r) => ({ value: r, label: RELATIONSHIP_LABELS[r], emoji: REL_EMOJI[r] }))} />
        </>
      );
    case "occasion":
      return (
        <>
          <Q title="Qual é a ocasião?" />
          <Chips value={answers.occasion} onChange={(v) => set("occasion", v)} options={OCCASIONS.map((o) => ({ value: o, label: OCCASION_LABELS[o], emoji: OCC_EMOJI[o] }))} />
        </>
      );
    case "startDate":
      return (
        <>
          <Q title="Quando tudo começou?" hint="A data em que se conheceram ou começaram a namorar. Vira um contador ao vivo na página ⏳" />
          <Input type="date" value={answers.startDate} onChange={(e) => set("startDate", e.target.value)} className="h-12 max-w-xs text-lg" aria-label="Data" />
        </>
      );
    case "howWeMet":
      return (
        <>
          <Q title="Como vocês se conheceram?" hint="Conte em poucas linhas. Ex.: “num aniversário de um amigo, você derrubou refrigerante em mim”." />
          <Textarea value={answers.howWeMet} onChange={(e) => set("howWeMet", e.target.value)} rows={5} maxLength={600} placeholder="Foi assim..." className="text-base" />
        </>
      );
    case "memories":
      return (
        <>
          <Q title="Três lembranças marcantes" hint="Momentos que você nunca esquece. Quanto mais detalhe, mais especial fica." />
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Textarea key={i} value={answers.memories[i] ?? ""} onChange={(e) => set("memories", [0, 1, 2].map((j) => (j === i ? e.target.value : answers.memories[j] ?? "")))} rows={2} maxLength={400} placeholder={["Ex.: nossa primeira viagem para a praia", "Ex.: o dia em que você cozinhou pra mim e queimou tudo", "Ex.: quando dançamos na chuva"][i]} aria-label={`Lembrança ${i + 1}`} />
            ))}
          </div>
        </>
      );
    case "lovedThings":
      return (
        <>
          <Q title={`O que você mais ama em ${to}?`} hint="Separe por vírgulas. Ex.: o sorriso, o jeito que cuida de mim, a risada escandalosa." />
          <Textarea value={answers.lovedThings} onChange={(e) => set("lovedThings", e.target.value)} rows={4} maxLength={800} />
        </>
      );
    case "insideJokes":
      return (
        <>
          <Q title="Piadas internas e apelidos carinhosos" hint="Aquelas coisas que só vocês dois entendem 🤭" />
          <Textarea value={answers.insideJokes} onChange={(e) => set("insideJokes", e.target.value)} rows={4} maxLength={500} placeholder="Ex.: “mozão”, a história do pastel, “só mais um episódio”..." />
        </>
      );
    case "tone":
      return (
        <>
          <Q title="Qual o clima da página?" hint="A IA escreve no tom que você escolher." />
          <Chips value={answers.tone} onChange={(v) => set("tone", v)} options={TONES.map((t) => ({ value: t, label: TONE_LABELS[t].label, emoji: TONE_LABELS[t].emoji, hint: TONE_LABELS[t].hint }))} />
        </>
      );
    case "template":
      return (
        <>
          <Q title="Escolha um estilo visual" hint="Você pode trocar e personalizar tudo depois." />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {templates.map((t) => {
              const bg = t.theme.background.type === "gradient" ? gradientCss(t.theme.background.gradient.colors, t.theme.background.gradient.angle) : t.theme.colors.background;
              const active = answers.templateId === t.id;
              return (
                <button key={t.id} type="button" onClick={() => set("templateId", t.id)} aria-pressed={active} className={cn("overflow-hidden rounded-2xl border-2 bg-white text-left transition", active ? "border-rose" : "border-line hover:border-ink/25")}>
                  <div className="flex aspect-square flex-col items-center justify-center" style={{ background: bg, color: t.theme.colors.text }}>
                    <span className="text-xs" style={{ fontFamily: fontStack(t.theme.fonts.script), color: t.theme.colors.primary }}>para você</span>
                    <span className="text-xl font-semibold" style={{ fontFamily: fontStack(t.theme.fonts.heading) }}>Amor</span>
                  </div>
                  <p className="px-2 py-1.5 text-xs font-medium">{t.name}</p>
                </button>
              );
            })}
          </div>
        </>
      );
  }
}
