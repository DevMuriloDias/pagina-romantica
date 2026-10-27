"use client";
import { ChevronDown, Crop, Lock, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Alert, Badge } from "@/components/ui/misc";
import { api } from "@/lib/client/api";
import type { ImageRef, Letter, Photo } from "@/lib/content/schema";
import { PAPERS } from "@/lib/content/schema";
import { FONTS } from "@/lib/theme/fonts";
import { uid, cn } from "@/lib/utils";
import { useBuilder } from "@/stores/builder";
import { AiTextArea, ChoiceChips, DateField, RemoveButton, SortableList, TextField } from "../fields";
import { CropDialog, ImageField, Thumb, UploadButton, useUploader } from "../media";
import { usePlans } from "../plans-context";
import type { EditorProps } from "./types";

const PAPER_LABEL: Record<(typeof PAPERS)[number], string> = { lined: "Pautado", kraft: "Kraft", vintage: "Vintage", plain: "Liso" };

function Collapsible({ title, subtitle, handle, onRemove, children, defaultOpen }: { title: string; subtitle?: string; handle?: React.ReactNode; onRemove?: () => void; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <div className="rounded-xl border border-line bg-white">
      <div className="flex items-center gap-1 p-2">
        {handle}
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{title || "Sem título"}</span>
            {subtitle ? <span className="block truncate text-xs text-ink-soft">{subtitle}</span> : null}
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-ink-soft transition-transform", open && "rotate-180")} />
        </button>
        {onRemove ? <RemoveButton onClick={onRemove} /> : null}
      </div>
      {open ? <div className="space-y-4 border-t border-line p-3">{children}</div> : null}
    </div>
  );
}

// ───────────── Cartas ─────────────

export function LettersEditor({ section, update }: EditorProps<"letters">) {
  const d = section.data;
  const meta = useBuilder((s) => s.content.meta);
  const plans = usePlans();
  const scriptFonts = FONTS.filter((f) => f.category === "script");
  const setLetter = (id: string, patch: Partial<Letter>, key?: string) => update((x) => ({ ...x, letters: x.letters.map((l) => (l.id === id ? { ...l, ...patch } : l)) }), key);
  const add = (kind: Letter["kind"]) =>
    update((x) => ({
      ...x,
      letters: [
        ...x.letters,
        { id: uid("l"), kind, openWhen: kind === "open_when" ? "estiver com saudade" : "", title: kind === "open_when" ? "Abra quando estiver com saudade" : "Uma carta para você", body: "", signature: meta.senderName ? `Com amor, ${meta.senderName}` : "", paper: "lined", font: "dancing", lockedUntil: "" },
      ],
    }));
  const overBase = plans.baseLetters !== null && d.letters.length > plans.baseLetters;

  return (
    <div className="space-y-4">
      <TextField label="Título da seção" value={d.title} onChange={(v, k) => update((x) => ({ ...x, title: v }), k)} />
      {d.letters.length === 0 ? <Alert tone="info">Nenhuma carta ainda. Que tal começar com uma carta principal? A IA pode te ajudar ✨</Alert> : null}
      <SortableList
        items={d.letters}
        onReorder={(letters) => update((x) => ({ ...x, letters }))}
        className="space-y-2"
        render={(l, i, handle) => (
          <Collapsible
            handle={handle}
            title={l.kind === "open_when" ? `Abra quando ${l.openWhen}` : l.title}
            subtitle={`${l.body.slice(0, 50) || "Ainda sem texto"}${l.lockedUntil ? " · 🔒 com data" : ""}`}
            onRemove={() => update((x) => ({ ...x, letters: x.letters.filter((y) => y.id !== l.id) }))}
            defaultOpen={i === 0 && d.letters.length === 1}
          >
            <ChoiceChips value={l.kind} onChange={(v) => setLetter(l.id, { kind: v })} options={[{ value: "normal", label: "Carta" }, { value: "open_when", label: "Abra quando..." }]} />
            {l.kind === "open_when" ? (
              <TextField label="Abra quando..." maxLength={80} value={l.openWhen} onChange={(v, k) => setLetter(l.id, { openWhen: v, title: `Abra quando ${v}` }, k)} placeholder="estiver triste / com saudade / precisar rir" />
            ) : (
              <TextField label="Título" value={l.title} onChange={(v, k) => setLetter(l.id, { title: v }, k)} />
            )}
            <AiTextArea
              label="Texto da carta"
              rows={9}
              maxLength={6000}
              value={l.body}
              fieldKey={`letter-${l.id}`}
              onChange={(v, k) => setLetter(l.id, { body: v }, k)}
              write={{ context: [l.title, l.openWhen].filter(Boolean).join(" — "), openWhen: l.kind === "open_when" ? l.openWhen : undefined }}
              placeholder="Escreva com o coração. Pode usar parágrafos."
            />
            <TextField label="Assinatura" maxLength={80} value={l.signature} onChange={(v, k) => setLetter(l.id, { signature: v }, k)} placeholder="Com amor, ..." />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Papel</p>
                <NativeSelect value={l.paper} onChange={(e) => setLetter(l.id, { paper: e.target.value as Letter["paper"] })} aria-label="Papel de carta">
                  {PAPERS.map((p) => (
                    <option key={p} value={p}>{PAPER_LABEL[p]}</option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Letra</p>
                <NativeSelect value={l.font} onChange={(e) => setLetter(l.id, { font: e.target.value as Letter["font"] })} aria-label="Fonte manuscrita">
                  {scriptFonts.map((f) => (
                    <option key={f.id} value={f.id} style={{ fontFamily: f.family }}>{f.family}</option>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <DateField label="🔒 Só pode abrir a partir de (opcional)" help="Antes dessa data, aparece um cadeado com contagem regressiva." value={l.lockedUntil} onChange={(v) => setLetter(l.id, { lockedUntil: v })} />
          </Collapsible>
        )}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => add("normal")}><Plus /> Carta</Button>
        <Button type="button" variant="outline" size="sm" onClick={() => add("open_when")}><Plus /> “Abra quando...”</Button>
      </div>
      {overBase ? <p className="text-xs text-ink-soft"><Badge tone="premium">Premium</Badge> O plano {plans.basePlanName} inclui até {plans.baseLetters} cartas. Com mais, o plano {plans.topPlanName} é selecionado no final.</p> : null}
    </div>
  );
}

// ───────────── Fotos ─────────────

const PHOTO_LAYOUTS = [
  { value: "polaroid", label: "Polaroids" },
  { value: "carousel", label: "Carrossel" },
  { value: "grid", label: "Grade" },
  { value: "slideshow", label: "Slideshow" },
  { value: "film", label: "Filme" },
  { value: "flipbook", label: "Livro" },
] as const;

export function PhotosEditor({ section, update }: EditorProps<"photos">) {
  const d = section.data;
  const plans = usePlans();
  const pageId = useBuilder((s) => s.pageId);
  const { upload, progress, error } = useUploader();
  const [cropping, setCropping] = useState<Photo | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const totalPhotos = useBuilder((s) => s.content.sections.filter((x) => x.type === "photos").reduce((n, x) => n + (x.type === "photos" ? x.data.photos.length : 0), 0));

  const addPhoto = (image: ImageRef) => update((x) => ({ ...x, photos: [...x.photos, { id: uid("p"), image, caption: "" }] }));
  const setPhoto = (id: string, patch: Partial<Photo>, key?: string) => update((x) => ({ ...x, photos: x.photos.map((p) => (p.id === id ? { ...p, ...patch } : p)) }), key);

  const suggestCaptions = async () => {
    setAiBusy(true);
    try {
      const { items } = await api<{ items: string[] }>("/api/ai/captions", { body: { pageId, count: Math.min(10, Math.max(3, d.photos.length)), context: d.title } });
      update((x) => ({ ...x, photos: x.photos.map((p, i) => (p.caption ? p : { ...p, caption: items[i % items.length] ?? "" })) }));
    } catch {
      /* silencioso: legendas são opcionais */
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <TextField label="Título da seção" value={d.title} onChange={(v, k) => update((x) => ({ ...x, title: v }), k)} />
      <ChoiceChips label="Como mostrar" value={d.layout} onChange={(v) => update((x) => ({ ...x, layout: v }))} options={PHOTO_LAYOUTS.map((l) => ({ ...l }))} />
      <div className="flex flex-wrap items-center gap-2">
        <UploadButton multiple onFiles={(files) => upload(files, addPhoto)} busy={progress ? `Enviando ${progress.done}/${progress.total}...` : null} />
        {d.photos.length ? (
          <Button type="button" variant="ghost" size="sm" onClick={suggestCaptions} disabled={aiBusy}>
            <Sparkles /> {aiBusy ? "Pensando..." : "Sugerir legendas"}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-ink-soft">
        {totalPhotos} foto(s) na página · {plans.basePlanName}: até {plans.basePhotos} · {plans.topPlanName}: até {plans.topPhotos}.
        {totalPhotos > plans.basePhotos ? <Badge tone="premium" className="ml-1">Premium</Badge> : null}
      </p>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {d.photos.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-line p-6 text-center text-sm text-ink-soft">Arraste aqui suas fotos favoritas de vocês 📸<br />As fotos são comprimidas no seu celular e os dados de localização são removidos.</div>
      ) : null}
      <SortableList
        items={d.photos}
        onReorder={(photos) => update((x) => ({ ...x, photos }))}
        className="space-y-2"
        render={(p, _i, handle) => (
          <div className="flex items-center gap-2 rounded-xl border border-line bg-white p-2">
            {handle}
            <Thumb image={p.image} className="size-14 shrink-0 rounded-lg" />
            <Input className="h-9 flex-1 text-sm" value={p.caption} maxLength={200} placeholder="Legenda (opcional)" onChange={(e) => setPhoto(p.id, { caption: e.target.value }, `cap-${p.id}`)} aria-label="Legenda da foto" />
            <button type="button" className="rounded-md p-1.5 text-ink-soft/60 hover:bg-ink/5 hover:text-ink" onClick={() => setCropping(p)} aria-label="Recortar foto" title="Recortar">
              <Crop className="size-4" />
            </button>
            <RemoveButton onClick={() => update((x) => ({ ...x, photos: x.photos.filter((y) => y.id !== p.id) }))} />
          </div>
        )}
      />
      {cropping ? <CropDialog image={cropping.image} onClose={() => setCropping(null)} onCropped={(img) => setPhoto(cropping.id, { image: { ...img, alt: cropping.image.alt } })} /> : null}
    </div>
  );
}

// ───────────── Linha do tempo ─────────────

export function TimelineEditor({ section, update }: EditorProps<"timeline">) {
  const d = section.data;
  type Ev = (typeof d.events)[number];
  const setEv = (id: string, patch: Partial<Ev>, key?: string) => update((x) => ({ ...x, events: x.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }), key);
  return (
    <div className="space-y-4">
      <TextField label="Título da seção" value={d.title} onChange={(v, k) => update((x) => ({ ...x, title: v }), k)} />
      <ChoiceChips label="Formato" value={d.layout} onChange={(v) => update((x) => ({ ...x, layout: v }))} options={[{ value: "vertical", label: "Vertical" }, { value: "horizontal", label: "Horizontal" }]} />
      <SortableList
        items={d.events}
        onReorder={(events) => update((x) => ({ ...x, events }))}
        className="space-y-2"
        render={(e, _i, handle) => (
          <Collapsible handle={handle} title={`${e.emoji || "♥"} ${e.title}`} subtitle={e.date || "sem data"} onRemove={() => update((x) => ({ ...x, events: x.events.filter((y) => y.id !== e.id) }))}>
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <TextField label="Título" value={e.title} onChange={(v, k) => setEv(e.id, { title: v }, k)} placeholder="Nosso primeiro beijo" />
              <TextField label="Emoji" maxLength={16} value={e.emoji} onChange={(v, k) => setEv(e.id, { emoji: v }, k)} placeholder="💋" />
            </div>
            <DateField label="Data" value={e.date} onChange={(v) => setEv(e.id, { date: v })} />
            <AiTextArea label="O que aconteceu" rows={3} maxLength={1000} value={e.description} onChange={(v, k) => setEv(e.id, { description: v }, k)} />
            <ImageField label="Foto (opcional)" value={e.image} onChange={(img) => setEv(e.id, { image: img })} aspect={16 / 9} />
          </Collapsible>
        )}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => update((x) => ({ ...x, events: [...x.events, { id: uid("t"), date: "", title: "Um momento especial", description: "", emoji: "💞" }] }))}>
        <Plus /> Adicionar momento
      </Button>
    </div>
  );
}

// ───────────── Lugares ─────────────

export function PlaceSearch({ onPick }: { onPick: (r: { label: string; lat: number; lng: number }) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const search = async () => {
    if (q.trim().length < 3) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ results: { label: string; lat: number; lng: number }[]; error?: string }>(`/api/geocode?q=${encodeURIComponent(q)}`);
      setResults(r.results);
      if (r.error) setMsg(r.error);
      else if (!r.results.length) setMsg("Nada encontrado. Tente incluir a cidade.");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro na busca");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())} placeholder="Buscar endereço ou lugar (ex.: Parque Ibirapuera, São Paulo)" aria-label="Buscar endereço" />
        <Button type="button" variant="outline" onClick={search} disabled={busy}>{busy ? "..." : "Buscar"}</Button>
      </div>
      {msg ? <p className="text-xs text-ink-soft">{msg}</p> : null}
      {results.length ? (
        <ul className="max-h-48 overflow-y-auto rounded-xl border border-line bg-white text-sm">
          {results.map((r) => (
            <li key={`${r.lat},${r.lng}`}>
              <button type="button" className="block w-full px-3 py-2 text-left hover:bg-blush/40" onClick={() => { onPick(r); setResults([]); setQ(""); }}>
                📍 {r.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function PlacesEditor({ section, update }: EditorProps<"places">) {
  const d = section.data;
  type Pl = (typeof d.places)[number];
  const setPl = (id: string, patch: Partial<Pl>, key?: string) => update((x) => ({ ...x, places: x.places.map((p) => (p.id === id ? { ...p, ...patch } : p)) }), key);
  return (
    <div className="space-y-4">
      <TextField label="Título da seção" value={d.title} onChange={(v, k) => update((x) => ({ ...x, title: v }), k)} />
      <ChoiceChips label="Formato" value={d.layout} onChange={(v) => update((x) => ({ ...x, layout: v }))} options={[{ value: "map", label: "Mapa com corações" }, { value: "passport", label: "Carimbos de passaporte" }]} />
      <div className="rounded-xl bg-blush/30 p-3">
        <p className="mb-2 text-sm font-medium">Adicionar um lugar</p>
        <PlaceSearch onPick={(r) => update((x) => ({ ...x, places: [...x.places, { id: uid("pl"), name: r.label.split(",")[0] ?? r.label, address: r.label, date: "", story: "", lat: r.lat, lng: r.lng }] }))} />
      </div>
      <SortableList
        items={d.places}
        onReorder={(places) => update((x) => ({ ...x, places }))}
        className="space-y-2"
        render={(p, _i, handle) => (
          <Collapsible handle={handle} title={`📍 ${p.name}`} subtitle={p.lat === null ? "⚠️ sem localização no mapa" : p.address} onRemove={() => update((x) => ({ ...x, places: x.places.filter((y) => y.id !== p.id) }))}>
            <TextField label="Nome do lugar" value={p.name} onChange={(v, k) => setPl(p.id, { name: v }, k)} />
            <DateField label="Quando?" value={p.date} onChange={(v) => setPl(p.id, { date: v })} />
            <AiTextArea label="A história desse lugar" rows={3} maxLength={1000} value={p.story} onChange={(v, k) => setPl(p.id, { story: v }, k)} />
            <ImageField label="Foto (opcional)" value={p.image} onChange={(img) => setPl(p.id, { image: img })} aspect={16 / 9} />
            <details className="text-sm">
              <summary className="cursor-pointer text-ink-soft">Mudar localização</summary>
              <div className="mt-2"><PlaceSearch onPick={(r) => setPl(p.id, { address: r.label, lat: r.lat, lng: r.lng })} /></div>
            </details>
          </Collapsible>
        )}
      />
    </div>
  );
}

// ───────────── Motivos ─────────────

export function ReasonsEditor({ section, update }: EditorProps<"reasons">) {
  const d = section.data;
  const pageId = useBuilder((s) => s.pageId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const items = d.reasons.map((r, i) => ({ id: `r${i}`, text: r }));
  const suggest = async () => {
    setBusy(true);
    setErr(null);
    try {
      const { items: got } = await api<{ items: string[] }>("/api/ai/reasons", { body: { pageId, count: 8, context: d.reasons.join("; ") } });
      update((x) => ({ ...x, reasons: [...x.reasons, ...got].slice(0, 100) }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <TextField label="Título da seção" value={d.title} onChange={(v, k) => update((x) => ({ ...x, title: v }), k)} />
      <ChoiceChips label="Formato" value={d.layout} onChange={(v) => update((x) => ({ ...x, layout: v }))} options={[{ value: "flip", label: "Cartões que viram" }, { value: "jar", label: "Pote de bilhetinhos" }]} />
      <SortableList
        items={items}
        onReorder={(list) => update((x) => ({ ...x, reasons: list.map((l) => l.text) }))}
        className="space-y-1.5"
        render={(r, i, handle) => (
          <div className="flex items-center gap-1">
            {handle}
            <Input className="h-9 text-sm" value={r.text} maxLength={240} onChange={(e) => update((x) => ({ ...x, reasons: x.reasons.map((y, j) => (j === i ? e.target.value : y)) }), `reason-${i}`)} aria-label={`Motivo ${i + 1}`} />
            <RemoveButton onClick={() => update((x) => ({ ...x, reasons: x.reasons.filter((_, j) => j !== i) }))} />
          </div>
        )}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => update((x) => ({ ...x, reasons: [...x.reasons, ""] }))}><Plus /> Motivo</Button>
        <Button type="button" variant="soft" size="sm" onClick={suggest} disabled={busy}><Sparkles /> {busy ? "Pensando..." : "Sugerir motivos com IA"}</Button>
      </div>
      {err ? <Alert tone="danger">{err}</Alert> : null}
    </div>
  );
}

// ───────────── Quiz ─────────────

export function QuizEditor({ section, update }: EditorProps<"quiz">) {
  const d = section.data;
  const pageId = useBuilder((s) => s.pageId);
  const [busy, setBusy] = useState(false);
  type Q = (typeof d.questions)[number];
  const setQ = (id: string, patch: Partial<Q>, key?: string) => update((x) => ({ ...x, questions: x.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) }), key);
  const generate = async () => {
    setBusy(true);
    try {
      const { items } = await api<{ items: Omit<Q, "id">[] }>("/api/ai/quiz", { body: { pageId, count: 4, context: d.questions.map((q) => q.question).join("; ") } });
      update((x) => ({ ...x, questions: [...x.questions, ...items.map((q) => ({ ...q, id: uid("q") }))].slice(0, 20) }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <TextField label="Título" value={d.title} onChange={(v, k) => update((x) => ({ ...x, title: v }), k)} />
      <SortableList
        items={d.questions}
        onReorder={(questions) => update((x) => ({ ...x, questions }))}
        className="space-y-2"
        render={(q, _i, handle) => (
          <Collapsible handle={handle} title={q.question} subtitle={`${q.options.length} opções`} onRemove={() => update((x) => ({ ...x, questions: x.questions.filter((y) => y.id !== q.id) }))}>
            <TextField label="Pergunta" maxLength={200} value={q.question} onChange={(v, k) => setQ(q.id, { question: v }, k)} />
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Opções (marque a certa)</p>
              {q.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input type="radio" name={`correct-${q.id}`} checked={q.correctIndex === oi} onChange={() => setQ(q.id, { correctIndex: oi })} aria-label={`Opção ${oi + 1} é a correta`} className="accent-rose" />
                  <Input className="h-9 text-sm" value={o} maxLength={120} onChange={(e) => setQ(q.id, { options: q.options.map((y, j) => (j === oi ? e.target.value : y)) }, `opt-${q.id}-${oi}`)} />
                  {q.options.length > 2 ? <RemoveButton onClick={() => setQ(q.id, { options: q.options.filter((_, j) => j !== oi), correctIndex: q.correctIndex >= oi && q.correctIndex > 0 ? q.correctIndex - 1 : q.correctIndex })} /> : null}
                </div>
              ))}
              {q.options.length < 4 ? <Button type="button" variant="ghost" size="sm" onClick={() => setQ(q.id, { options: [...q.options, ""] })}><Plus /> Opção</Button> : null}
            </div>
          </Collapsible>
        )}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => update((x) => ({ ...x, questions: [...x.questions, { id: uid("q"), question: "Nova pergunta", options: ["Opção A", "Opção B", "Opção C"], correctIndex: 0 }] }))}><Plus /> Pergunta</Button>
        <Button type="button" variant="soft" size="sm" onClick={generate} disabled={busy}><Sparkles /> {busy ? "Criando..." : "Gerar perguntas com IA"}</Button>
      </div>
      <TextField label="Resultado — acertou quase tudo" maxLength={240} value={d.resultHigh} onChange={(v, k) => update((x) => ({ ...x, resultHigh: v }), k)} />
      <TextField label="Resultado — acertou metade" maxLength={240} value={d.resultMid} onChange={(v, k) => update((x) => ({ ...x, resultMid: v }), k)} />
      <TextField label="Resultado — acertou pouco" maxLength={240} value={d.resultLow} onChange={(v, k) => update((x) => ({ ...x, resultLow: v }), k)} />
    </div>
  );
}

// ───────────── Cupons ─────────────

export function CouponsEditor({ section, update }: EditorProps<"coupons">) {
  const d = section.data;
  type C = (typeof d.coupons)[number];
  const setC = (id: string, patch: Partial<C>, key?: string) => update((x) => ({ ...x, coupons: x.coupons.map((c) => (c.id === id ? { ...c, ...patch } : c)) }), key);
  return (
    <div className="space-y-4">
      <TextField label="Título" value={d.title} onChange={(v, k) => update((x) => ({ ...x, title: v }), k)} />
      <SortableList
        items={d.coupons}
        onReorder={(coupons) => update((x) => ({ ...x, coupons }))}
        className="space-y-2"
        render={(c, _i, handle) => (
          <Collapsible handle={handle} title={`${c.emoji} ${c.title}`} subtitle={c.description} onRemove={() => update((x) => ({ ...x, coupons: x.coupons.filter((y) => y.id !== c.id) }))}>
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <TextField label="Vale..." maxLength={80} value={c.title} onChange={(v, k) => setC(c.id, { title: v }, k)} />
              <TextField label="Emoji" maxLength={16} value={c.emoji} onChange={(v, k) => setC(c.id, { emoji: v }, k)} />
            </div>
            <TextField label="Detalhes" maxLength={200} value={c.description} onChange={(v, k) => setC(c.id, { description: v }, k)} />
          </Collapsible>
        )}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => update((x) => ({ ...x, coupons: [...x.coupons, { id: uid("c"), title: "Vale um cinema", description: "Com pipoca grande.", emoji: "🍿" }] }))}><Plus /> Vale</Button>
      <Alert tone="info">Quando seu amor resgatar um vale, você recebe um e-mail avisando. 🎟️</Alert>
    </div>
  );
}

// ───────────── Céu ─────────────

export function SkyEditor({ section, update }: EditorProps<"sky">) {
  const d = section.data;
  return (
    <div className="space-y-4">
      <TextField label="Título" value={d.title} onChange={(v, k) => update((x) => ({ ...x, title: v }), k)} />
      <div className="grid grid-cols-2 gap-3">
        <DateField label="Data" value={d.date} onChange={(v) => update((x) => ({ ...x, date: v }))} />
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Hora</p>
          <Input type="time" value={d.time} onChange={(e) => update((x) => ({ ...x, time: e.target.value }))} aria-label="Hora" />
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">Cidade {d.city ? <span className="text-ink-soft">— {d.city}</span> : null}</p>
        <PlaceSearch onPick={(r) => update((x) => ({ ...x, city: r.label.split(",").slice(0, 2).join(",").trim(), lat: r.lat, lng: r.lng }))} />
        {d.lat === null ? <p className="text-xs text-amber-700"><Lock className="mr-1 inline size-3" />Busque a cidade para desenhar o céu.</p> : null}
      </div>
      <AiTextArea label="Legenda poética" rows={2} maxLength={240} value={d.caption} onChange={(v, k) => update((x) => ({ ...x, caption: v }), k)} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-rose" checked={d.showConstellations} onChange={(e) => update((x) => ({ ...x, showConstellations: e.target.checked }))} /> Mostrar linhas das constelações
      </label>
    </div>
  );
}
