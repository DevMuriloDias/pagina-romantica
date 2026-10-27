"use client";
import { Alert } from "@/components/ui/misc";
import { Switch } from "@/components/ui/switch";
import { parseYouTubeId } from "@/lib/music";
import { AiTextArea, ChoiceChips, DateField, TextField } from "../fields";
import { ImageField } from "../media";
import type { EditorProps } from "./types";

export function HeroEditor({ section, update }: EditorProps<"hero">) {
  const d = section.data;
  return (
    <div className="space-y-4">
      <TextField label="Título" value={d.title} onChange={(v, k) => update((x) => ({ ...x, title: v }), k)} placeholder="Ex.: Feliz aniversário, meu amor!" />
      <AiTextArea label="Subtítulo" rows={2} maxLength={240} value={d.subtitle} onChange={(v, k) => update((x) => ({ ...x, subtitle: v }), k)} placeholder="Ex.: Cada pedacinho desta página foi pensado em você" />
      <ChoiceChips label="Estilo da capa" value={d.layout} onChange={(v) => update((x) => ({ ...x, layout: v }))} options={[{ value: "centered", label: "Só texto" }, { value: "photo", label: "Com foto polaroid" }]} />
      {d.layout === "photo" ? <ImageField label="Foto da capa" value={d.photo} aspect={1} onChange={(img) => update((x) => ({ ...x, photo: img }))} /> : null}
    </div>
  );
}

export function CounterEditor({ section, update }: EditorProps<"counter">) {
  const d = section.data;
  return (
    <div className="space-y-4">
      <TextField label="Título" value={d.title} onChange={(v, k) => update((x) => ({ ...x, title: v }), k)} placeholder="Juntos há" />
      <DateField withTime label="Desde quando?" help="A data (e hora, se quiser) em que tudo começou." value={d.startDate} onChange={(v) => update((x) => ({ ...x, startDate: v }))} />
      <ChoiceChips label="Estilo do relógio" value={d.style} onChange={(v) => update((x) => ({ ...x, style: v }))} options={[{ value: "flip", label: "Flip clock" }, { value: "minimal", label: "Minimalista" }, { value: "hearts", label: "Corações" }]} />
    </div>
  );
}

export function CountdownEditor({ section, update }: EditorProps<"countdown">) {
  const d = section.data;
  return (
    <div className="space-y-4">
      <TextField label="Título" value={d.title} onChange={(v, k) => update((x) => ({ ...x, title: v }), k)} placeholder="Falta pouco" />
      <TextField label="Qual é o evento?" value={d.eventName} onChange={(v, k) => update((x) => ({ ...x, eventName: v }), k)} placeholder="Ex.: Nossa viagem para Paris" />
      <DateField withTime label="Quando?" value={d.targetDate} onChange={(v) => update((x) => ({ ...x, targetDate: v }))} />
      <TextField label="Mensagem quando chegar o dia" value={d.doneMessage} maxLength={200} onChange={(v, k) => update((x) => ({ ...x, doneMessage: v }), k)} />
      <ChoiceChips label="Estilo" value={d.style} onChange={(v) => update((x) => ({ ...x, style: v }))} options={[{ value: "flip", label: "Flip clock" }, { value: "minimal", label: "Minimalista" }, { value: "hearts", label: "Corações" }]} />
    </div>
  );
}

export function VideoEditor({ section, update }: EditorProps<"video">) {
  const d = section.data;
  const id = parseYouTubeId(d.url);
  return (
    <div className="space-y-4">
      <TextField label="Título" value={d.title} onChange={(v, k) => update((x) => ({ ...x, title: v }), k)} />
      <TextField label="Link do vídeo no YouTube" maxLength={300} value={d.url} onChange={(v, k) => update((x) => ({ ...x, url: v }), k)} placeholder="https://youtu.be/..." help="Dica: envie o vídeo como “não listado” no YouTube para ficar privado." />
      {d.url && !id ? <Alert tone="warning">Não reconhecemos esse link. Cole o endereço de um vídeo do YouTube.</Alert> : null}
      <TextField label="Legenda (opcional)" maxLength={240} value={d.caption} onChange={(v, k) => update((x) => ({ ...x, caption: v }), k)} />
    </div>
  );
}

export function FinaleEditor({ section, update }: EditorProps<"finale">) {
  const d = section.data;
  return (
    <div className="space-y-4">
      <AiTextArea label="Frase final" rows={3} maxLength={400} value={d.phrase} onChange={(v, k) => update((x) => ({ ...x, phrase: v }), k)} placeholder="Ex.: Hoje, amanhã e sempre: é você." />
      <TextField label="Assinatura" help="Ela aparece como se estivesse sendo escrita à mão." maxLength={60} value={d.signature} onChange={(v, k) => update((x) => ({ ...x, signature: v }), k)} placeholder="Seu nome ou apelido" />
    </div>
  );
}

export function GuestbookEditor({ section, update }: EditorProps<"guestbook">) {
  const d = section.data;
  return (
    <div className="space-y-4">
      <TextField label="Título" value={d.title} onChange={(v, k) => update((x) => ({ ...x, title: v }), k)} />
      <TextField label="Convite para escrever" maxLength={240} value={d.prompt} onChange={(v, k) => update((x) => ({ ...x, prompt: v }), k)} />
      <Alert tone="info">Os recados chegam no seu e-mail e ficam em Configurações → Recados. Só você vê.</Alert>
    </div>
  );
}

export function ProposalEditor({ section, update }: EditorProps<"proposal">) {
  const d = section.data;
  return (
    <div className="space-y-4">
      <ChoiceChips label="Tipo de pedido" value={d.kind} onChange={(v) => update((x) => ({ ...x, kind: v }))} options={[{ value: "namoro", label: "Namoro", emoji: "💘" }, { value: "casamento", label: "Casamento", emoji: "💍" }, { value: "outro", label: "Outro", emoji: "✨" }]} />
      <TextField label="Pergunta" maxLength={200} value={d.question} onChange={(v, k) => update((x) => ({ ...x, question: v }), k)} placeholder="Quer namorar comigo?" />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Botão Sim" maxLength={40} value={d.yesLabel} onChange={(v, k) => update((x) => ({ ...x, yesLabel: v }), k)} />
        <TextField label="Botão Não" maxLength={40} value={d.noLabel} onChange={(v, k) => update((x) => ({ ...x, noLabel: v }), k)} help="Ele foge do dedo 😏" />
      </div>
      <AiTextArea label="Mensagem depois do Sim" rows={3} maxLength={400} value={d.yesMessage} onChange={(v, k) => update((x) => ({ ...x, yesMessage: v }), k)} />
      <Alert tone="info">Você recebe um e-mail com a resposta assim que ela for dada. 💌</Alert>
    </div>
  );
}

export function ScratchEditor({ section, update }: EditorProps<"scratch">) {
  const d = section.data;
  return (
    <div className="space-y-4">
      <TextField label="Título" value={d.title} onChange={(v, k) => update((x) => ({ ...x, title: v }), k)} />
      <TextField label="Instrução na raspadinha" maxLength={160} value={d.instructions} onChange={(v, k) => update((x) => ({ ...x, instructions: v }), k)} />
      <ChoiceChips label="O que fica escondido?" value={d.hiddenType} onChange={(v) => update((x) => ({ ...x, hiddenType: v }))} options={[{ value: "text", label: "Uma mensagem" }, { value: "image", label: "Uma foto" }]} />
      {d.hiddenType === "text" ? (
        <AiTextArea label="Mensagem escondida" rows={3} maxLength={300} value={d.hiddenText} onChange={(v, k) => update((x) => ({ ...x, hiddenText: v }), k)} placeholder="Ex.: Vamos viajar para Gramado em julho! ✈️" />
      ) : (
        <ImageField label="Foto escondida" value={d.hiddenImage} onChange={(img) => update((x) => ({ ...x, hiddenImage: img }))} aspect={4 / 3} />
      )}
    </div>
  );
}

export function ToggleRow({ label, help, checked, onChange }: { label: string; help?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-line bg-white p-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {help ? <span className="block text-xs text-ink-soft">{help}</span> : null}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
