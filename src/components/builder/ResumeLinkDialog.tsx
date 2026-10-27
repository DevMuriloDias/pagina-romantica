"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { api } from "@/lib/client/api";
import { useBuilder } from "@/stores/builder";

export function ResumeLinkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pageId = useBuilder((s) => s.pageId);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      await api(`/api/pages/${pageId}/resume-link`, { body: { email } });
      setState("sent");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Erro");
      setState("error");
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader title="Continuar depois? 💕" description="Mandamos um link para você retomar de onde parou, em qualquer aparelho." />
        {state === "sent" ? (
          <Alert tone="success">Pronto! Confira seu e-mail (e a caixa de spam). Seu rascunho fica guardado por 30 dias.</Alert>
        ) : (
          <form onSubmit={send} className="space-y-3">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" aria-label="Seu e-mail" autoComplete="email" />
            {state === "error" ? <Alert tone="danger">{msg}</Alert> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Agora não</Button>
              <Button type="submit" disabled={state === "sending"}>{state === "sending" ? "Enviando..." : "Receber link"}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
