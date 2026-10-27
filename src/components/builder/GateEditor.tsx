"use client";
import { Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { api } from "@/lib/client/api";
import { useBuilder } from "@/stores/builder";
import { ChoiceChips, RemoveButton, TextField } from "./fields";

/** Tela de entrada: as respostas vão direto para o servidor (hash bcrypt) e nunca ficam no conteúdo. */
export function GateEditor({ onPreviewGate }: { onPreviewGate: () => void }) {
  const gate = useBuilder((s) => s.content.gate);
  const pageId = useBuilder((s) => s.pageId);
  const setContent = useBuilder((s) => s.setContent);
  const set = (patch: Partial<typeof gate>, key?: string) => setContent((c) => ({ ...c, gate: { ...c.gate, ...patch } }), key);
  const [answers, setAnswers] = useState<string[]>([""]);
  const [status, setStatus] = useState<{ tone: "success" | "danger"; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (mode = gate.mode) => {
    setBusy(true);
    setStatus(null);
    try {
      const r = await api<{ answersCount: number }>(`/api/pages/${pageId}/gate`, { method: "PUT", body: { mode, answers: mode === "none" ? [] : answers.filter((a) => a.trim()) } });
      set({ mode, answersCount: r.answersCount });
      setAnswers([""]);
      setStatus({ tone: "success", msg: mode === "none" ? "Proteção removida." : `${r.answersCount} resposta(s) salva(s) com segurança ✓` });
    } catch (err) {
      setStatus({ tone: "danger", msg: err instanceof Error ? err.message : "Erro ao salvar" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl">Tela de entrada 🔐</h2>
        <p className="text-xs text-ink-soft">É a “porta” da página. O toque nela também libera a música para tocar.</p>
      </div>
      <ChoiceChips
        value={gate.mode}
        onChange={(v) => {
          if (v === "none") void save("none");
          else set({ mode: v, question: gate.question || (v === "password" ? "Digite a nossa data especial (DDMMAAAA)" : "Onde foi nosso primeiro beijo?") });
        }}
        options={[
          { value: "none", label: "Sem proteção", emoji: "💌" },
          { value: "password", label: "Senha", emoji: "🔢" },
          { value: "question", label: "Pergunta secreta", emoji: "❓" },
        ]}
      />
      <TextField label="Mensagem de boas-vindas" maxLength={200} value={gate.welcomeText} onChange={(v, k) => set({ welcomeText: v }, k)} placeholder="Marina, preparei uma surpresa para você" />
      <TextField label="Texto do botão" maxLength={40} value={gate.buttonLabel} onChange={(v, k) => set({ buttonLabel: v }, k)} placeholder={gate.mode === "none" ? "Abrir 💌" : "Entrar 💌"} />

      {gate.mode !== "none" ? (
        <div className="space-y-4 rounded-2xl border border-line bg-white p-4">
          <TextField
            label={gate.mode === "password" ? "Instrução da senha" : "Pergunta"}
            maxLength={200}
            value={gate.question}
            onChange={(v, k) => set({ question: v }, k)}
            help={gate.mode === "password" ? "Ex.: “Nossa data no formato DDMMAAAA”." : "Algo que só seu amor sabe responder."}
          />
          <div className="space-y-2">
            <p className="text-sm font-medium">{gate.mode === "password" ? "Senha" : "Respostas aceitas"}</p>
            <p className="text-xs text-ink-soft">
              {gate.mode === "password" ? "Ex.: 12062021. Barras e espaços são ignorados." : "Maiúsculas, acentos e espaços extras não importam. Cadastre variações (ex.: “praia”, “na praia”, “praia do forte”)."}
            </p>
            {answers.map((a, i) => (
              <div key={i} className="flex gap-2">
                <Input value={a} onChange={(e) => setAnswers((list) => list.map((x, j) => (j === i ? e.target.value : x)))} placeholder={gate.mode === "password" ? "12062021" : i === 0 ? "Resposta principal" : "Outra forma de responder"} aria-label={`Resposta ${i + 1}`} autoComplete="off" />
                {answers.length > 1 ? <RemoveButton onClick={() => setAnswers((l) => l.filter((_, j) => j !== i))} /> : null}
              </div>
            ))}
            {gate.mode === "question" && answers.length < 10 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => setAnswers((l) => [...l, ""])}><Plus /> Resposta alternativa</Button>
            ) : null}
            <Button type="button" onClick={() => save()} disabled={busy || !answers.some((a) => a.trim())}>
              <ShieldCheck /> {busy ? "Salvando..." : gate.answersCount ? "Substituir respostas" : "Salvar respostas"}
            </Button>
            {gate.answersCount ? <p className="text-xs text-emerald-700">✓ {gate.answersCount} resposta(s) cadastrada(s). Por segurança, elas ficam criptografadas e não aparecem aqui.</p> : <p className="text-xs text-amber-700">Enquanto não houver resposta salva, a página abre só com o botão.</p>}
          </div>
          <TextField label="Dica (opcional)" maxLength={200} value={gate.hint} onChange={(v, k) => set({ hint: v }, k)} placeholder="Foi num dia de chuva ☔" />
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Mostrar a dica depois de</p>
            <Input type="number" min={1} max={10} value={gate.hintAfter} onChange={(e) => set({ hintAfter: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} className="w-24" aria-label="Tentativas antes da dica" />
            <p className="text-xs text-ink-soft">tentativas erradas</p>
          </div>
          <TextField label="Mensagem de erro" maxLength={200} value={gate.errorMessage} onChange={(v, k) => set({ errorMessage: v }, k)} placeholder="Hmm, não foi dessa vez... tenta de novo, amor 💕" />
        </div>
      ) : null}
      {status ? <Alert tone={status.tone}>{status.msg}</Alert> : null}
      <Button type="button" variant="outline" onClick={onPreviewGate}>👀 Ver e testar a tela de entrada</Button>
    </div>
  );
}
