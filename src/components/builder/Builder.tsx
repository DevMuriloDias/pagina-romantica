"use client";
import { Check, CloudOff, Eye, Loader2, Monitor, Pencil, Redo2, Smartphone, Undo2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PageContent } from "@/lib/content/schema";
import type { Theme } from "@/lib/theme/schema";
import type { TemplateDef } from "@/lib/theme/templates";
import { cn } from "@/lib/utils";
import { useBuilder } from "@/stores/builder";
import { GateEditor } from "./GateEditor";
import { MusicEditor } from "./MusicEditor";
import { PlansProvider, type PlansInfo } from "./plans-context";
import { Preview, type Device } from "./Preview";
import { ResumeLinkDialog } from "./ResumeLinkDialog";
import { SectionsPanel } from "./SectionsPanel";
import { SettingsPanel } from "./SettingsPanel";
import { ThemeEditor } from "./ThemeEditor";
import { useAutosave } from "./useAutosave";

export interface BuilderProps {
  page: { id: string; status: string; content: PageContent; theme: Theme; slug: string | null; publicUrl: string | null; pendingOrderId: string | null };
  templates: TemplateDef[];
  plans: Omit<PlansInfo, "premiumSections"> & { premiumSections: string[] };
}

function SaveIndicator() {
  const state = useBuilder((s) => s.saveState);
  const error = useBuilder((s) => s.saveError);
  if (state === "saving" || state === "dirty") return <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft"><Loader2 className="size-3.5 animate-spin" /> <span className="hidden sm:inline">Salvando...</span></span>;
  if (state === "error") return <span className="inline-flex max-w-56 items-center gap-1.5 truncate text-xs text-red-700" title={error ?? ""}><CloudOff className="size-3.5 shrink-0" /> {error ?? "Erro ao salvar"}</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700" data-testid="saved"><Check className="size-3.5" /> <span className="sr-only sm:not-sr-only">Salvo</span></span>;
  return <span className="hidden text-xs text-ink-soft sm:inline">Salvo automaticamente</span>;
}

export function Builder({ page, templates, plans }: BuilderProps) {
  const init = useBuilder((s) => s.init);
  const ready = useBuilder((s) => s.pageId === page.id);
  const status = useBuilder((s) => s.status);
  const canUndo = useBuilder((s) => s.past.length > 0);
  const canRedo = useBuilder((s) => s.future.length > 0);
  const undo = useBuilder((s) => s.undo);
  const redo = useBuilder((s) => s.redo);
  const [device, setDevice] = useState<Device>("mobile");
  const [mobileView, setMobileView] = useState<"edit" | "view">("edit");
  const [gateKey, setGateKey] = useState(0);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [tab, setTab] = useState("secoes");

  useEffect(() => {
    const tpl = templates.find((t) => t.id === page.theme.templateId)?.theme ?? null;
    init({ pageId: page.id, status: page.status, content: page.content, theme: page.theme, templateDefault: tpl });
  }, [init, page, templates]);

  useAutosave();

  // Atalhos: Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+Y (fora de campos de texto)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  // "Intenção de saída" no desktop: oferece o link para continuar depois (uma vez por sessão)
  useEffect(() => {
    if (page.status !== "DRAFT") return;
    const onLeave = (e: MouseEvent) => {
      if (e.clientY > 0 || sessionStorage.getItem("aep_exit_offer")) return;
      sessionStorage.setItem("aep_exit_offer", "1");
      setResumeOpen(true);
    };
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => document.documentElement.removeEventListener("mouseleave", onLeave);
  }, [page.status]);

  const focusSection = useCallback((id: string) => {
    setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }));
  }, []);

  if (!ready) return <div className="flex min-h-svh items-center justify-center"><Loader2 className="size-6 animate-spin text-rose" /></div>;

  const plansInfo: PlansInfo = { ...plans, premiumSections: new Set(plans.premiumSections) };
  const published = status === "PUBLISHED";

  return (
    <PlansProvider value={plansInfo}>
      <div className="flex h-svh flex-col bg-paper">
        <header className="flex h-14 shrink-0 items-center gap-1 overflow-hidden border-b border-line bg-white/80 px-3 backdrop-blur sm:px-4">
          <Logo className="hidden text-base sm:inline-flex" />
          <div className="flex items-center gap-0.5 sm:ml-4">
            <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} aria-label="Desfazer" title="Desfazer (Ctrl+Z)"><Undo2 /></Button>
            <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} aria-label="Refazer" title="Refazer (Ctrl+Shift+Z)"><Redo2 /></Button>
          </div>
          <div className="ml-1"><SaveIndicator /></div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center rounded-full bg-ink/5 p-1 lg:flex" role="group" aria-label="Tamanho da prévia">
              <button type="button" onClick={() => setDevice("mobile")} className={cn("rounded-full p-1.5", device === "mobile" && "bg-white shadow-sm")} aria-pressed={device === "mobile"} aria-label="Prévia no celular"><Smartphone className="size-4" /></button>
              <button type="button" onClick={() => setDevice("desktop")} className={cn("rounded-full p-1.5", device === "desktop" && "bg-white shadow-sm")} aria-pressed={device === "desktop"} aria-label="Prévia no computador"><Monitor className="size-4" /></button>
            </div>
            <div className="flex items-center rounded-full bg-ink/5 p-1 lg:hidden" role="group" aria-label="Alternar entre editar e ver">
              <button type="button" onClick={() => setMobileView("edit")} className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium", mobileView === "edit" && "bg-white shadow-sm")} aria-pressed={mobileView === "edit"}><Pencil className="size-3.5" /> Editar</button>
              <button type="button" onClick={() => setMobileView("view")} className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium", mobileView === "view" && "bg-white shadow-sm")} aria-pressed={mobileView === "view"}><Eye className="size-3.5" /> Ver</button>
            </div>
            {published ? (
              <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex"><a href={page.publicUrl ?? "#"} target="_blank" rel="noreferrer">Ver página</a></Button>
            ) : (
              <Button asChild size="sm"><Link href={`/criar/revisao?page=${page.id}`}><span className="sm:hidden">Finalizar</span><span className="hidden sm:inline">Revisar e finalizar</span> →</Link></Button>
            )}
          </div>
        </header>

        {status === "PENDING_PAYMENT" && page.pendingOrderId ? (
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
            Você tem um pagamento em andamento. <Link className="font-semibold underline" href={`/criar/checkout?page=${page.id}&order=${page.pendingOrderId}`}>Voltar ao pagamento</Link>
          </div>
        ) : null}
        {published ? <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-1.5 text-center text-xs text-emerald-900">Página publicada <Badge tone="success">no ar</Badge> — as alterações aparecem para quem tem o link assim que são salvas.</div> : null}

        <div className="flex min-h-0 flex-1">
          <aside className={cn("min-h-0 w-full shrink-0 overflow-y-auto border-r border-line bg-paper lg:block lg:w-[440px]", mobileView === "view" && "hidden")}>
            <Tabs value={tab} onValueChange={setTab} className="p-4">
              <TabsList className="sticky top-0 z-10 mb-4 flex w-full overflow-x-auto bg-cream shadow-sm [scrollbar-width:none]">
                <TabsTrigger value="secoes">Seções</TabsTrigger>
                <TabsTrigger value="visual">Visual</TabsTrigger>
                <TabsTrigger value="musica">Música</TabsTrigger>
                <TabsTrigger value="entrada">Entrada</TabsTrigger>
                <TabsTrigger value="mais">Mais</TabsTrigger>
              </TabsList>
              <TabsContent value="secoes"><SectionsPanel onFocusSection={focusSection} /></TabsContent>
              <TabsContent value="visual"><ThemeEditor templates={templates} /></TabsContent>
              <TabsContent value="musica"><MusicEditor /></TabsContent>
              <TabsContent value="entrada">
                <GateEditor onPreviewGate={() => { setGateKey((k) => k + 1); setMobileView("view"); }} />
              </TabsContent>
              <TabsContent value="mais"><SettingsPanel publicUrl={page.publicUrl} slug={page.slug} onResumeLink={() => setResumeOpen(true)} /></TabsContent>
            </Tabs>
            {!published ? (
              <div className="px-4 pb-8 lg:hidden">
                <Alert tone="info">Toque em <strong>Ver</strong> no topo para conferir como está ficando.</Alert>
              </div>
            ) : null}
          </aside>
          <section className={cn("relative min-h-0 flex-1 flex-col items-center bg-[radial-gradient(circle_at_50%_0%,#f6d9d5_0%,transparent_60%)] p-4 lg:flex lg:p-8", mobileView === "edit" ? "hidden" : "flex")} aria-label="Prévia da página">
            <div className="mb-3 flex items-center gap-2 text-xs text-ink-soft">
              Prévia ao vivo
              {gateKey > 0 ? <button type="button" className="underline" onClick={() => setGateKey(0)}>fechar tela de entrada</button> : <button type="button" className="underline" onClick={() => setGateKey((k) => k + 1)}>ver tela de entrada</button>}
            </div>
            <div className="min-h-0 w-full flex-1">
              <Preview device={device} gateKey={gateKey} focusId={focus} watermark={!published} />
            </div>
          </section>
        </div>
        <ResumeLinkDialog open={resumeOpen} onClose={() => setResumeOpen(false)} />
      </div>
    </PlansProvider>
  );
}
