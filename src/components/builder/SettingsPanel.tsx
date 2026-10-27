"use client";
import { Download, ExternalLink, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/misc";
import { api } from "@/lib/client/api";
import { formatDateTime } from "@/lib/format";
import { useBuilder } from "@/stores/builder";
import { ToggleRow } from "./editors/simple";
import { CopyButton } from "./CopyButton";

interface InboxEvent {
  id: string;
  type: "GUESTBOOK" | "PROPOSAL_ANSWER" | "COUPON_REDEEMED" | "OPENED";
  data: Record<string, string>;
  createdAt: string;
}

export function SettingsPanel({ publicUrl, slug, onResumeLink }: { publicUrl: string | null; slug: string | null; onResumeLink: () => void }) {
  const settings = useBuilder((s) => s.content.settings);
  const status = useBuilder((s) => s.status);
  const pageId = useBuilder((s) => s.pageId);
  const setContent = useBuilder((s) => s.setContent);
  const [inbox, setInbox] = useState<InboxEvent[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (status !== "PUBLISHED") return;
    api<{ events: InboxEvent[] }>(`/api/pages/${pageId}/inbox`).then((r) => setInbox(r.events)).catch(() => setInbox([]));
  }, [pageId, status]);

  const del = async () => {
    if (!confirm("Excluir a página e TODAS as fotos permanentemente? Essa ação não pode ser desfeita.")) return;
    if (status === "PUBLISHED" && !confirm("Sua página já foi paga e está no ar. Tem certeza? O link vai parar de funcionar.")) return;
    setDeleting(true);
    try {
      await api(`/api/pages/${pageId}`, { method: "DELETE" });
      window.location.href = "/?excluida=1";
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao excluir");
      setDeleting(false);
    }
  };

  const opened = inbox?.filter((e) => e.type === "OPENED").length ?? 0;
  const messages = inbox?.filter((e) => e.type !== "OPENED") ?? [];

  return (
    <div className="space-y-4">
      <h2 className="font-display text-xl">Configurações</h2>
      {publicUrl && slug ? (
        <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
          <p className="text-sm font-semibold text-emerald-900">✓ Sua página está no ar</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-white px-2 py-1.5 text-xs">{publicUrl}</code>
            <CopyButton text={publicUrl} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline"><a href={publicUrl} target="_blank" rel="noreferrer"><ExternalLink /> Abrir</a></Button>
            <Button asChild size="sm" variant="outline"><a href={`/api/qr/${slug}?format=png&download=1`}><Download /> QR PNG</a></Button>
            <Button asChild size="sm" variant="outline"><a href={`/api/qr/${slug}?format=svg&download=1`}><Download /> QR SVG</a></Button>
          </div>
          <p className="text-xs text-emerald-900/80">As alterações que você fizer aqui aparecem na página na hora.</p>
        </section>
      ) : null}

      <ToggleRow label="Me avisar quando a página for aberta" help="Você recebe um e-mail na primeira vez que seu amor abrir." checked={settings.notifyOnOpen} onChange={(v) => setContent((c) => ({ ...c, settings: { ...c.settings, notifyOnOpen: v } }))} />

      {status === "PUBLISHED" ? (
        <section className="space-y-2 rounded-2xl border border-line bg-white p-4">
          <h3 className="font-display text-lg">Recados e respostas 💌</h3>
          <p className="text-xs text-ink-soft">{opened ? `Página aberta ${opened} vez(es).` : "A página ainda não foi aberta."}</p>
          {inbox === null ? <p className="text-sm text-ink-soft">Carregando...</p> : messages.length === 0 ? <p className="text-sm text-ink-soft">Nada por aqui ainda.</p> : null}
          <ul className="space-y-2">
            {messages.map((e) => (
              <li key={e.id} className="rounded-xl bg-cream/60 p-3 text-sm">
                <p className="text-xs text-ink-soft">{formatDateTime(e.createdAt)}</p>
                {e.type === "GUESTBOOK" ? <p><strong>{e.data.name || "Recado"}:</strong> {e.data.message}</p> : null}
                {e.type === "PROPOSAL_ANSWER" ? <p>💍 Resposta ao pedido: <strong>{e.data.answer === "yes" ? "SIM! 🎉" : "não"}</strong></p> : null}
                {e.type === "COUPON_REDEEMED" ? <p>🎟️ Vale resgatado: <strong>{e.data.title}</strong></p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="space-y-2 rounded-2xl border border-line bg-white p-4">
          <h3 className="font-display text-lg">Continuar em outro momento</h3>
          <p className="text-sm text-ink-soft">Tudo é salvo automaticamente neste navegador. Quer continuar no celular ou outro computador?</p>
          <Button type="button" variant="outline" size="sm" onClick={onResumeLink}>📧 Receber link para continuar depois</Button>
        </section>
      )}

      <section className="space-y-2 rounded-2xl border border-red-200 bg-red-50/40 p-4">
        <h3 className="font-display text-lg text-red-900">Excluir página e dados</h3>
        <p className="text-sm text-red-900/80">Apaga a página, todas as fotos e as respostas recebidas (LGPD). Não dá para desfazer.</p>
        <Button type="button" variant="destructive" size="sm" onClick={del} disabled={deleting}><Trash2 /> {deleting ? "Excluindo..." : "Excluir página"}</Button>
      </section>
      {status === "UNPUBLISHED" ? <Alert tone="danger">Esta página foi despublicada. Fale com o suporte se achar que foi um engano.</Alert> : null}
    </div>
  );
}
