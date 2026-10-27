"use client";
import { useState } from "react";
import { SectionShell, SectionTitle } from "../SectionShell";
import { useRuntime } from "../runtime";
import type { SectionProps } from "../types";

export function Guestbook({ section, theme }: SectionProps<"guestbook">) {
  const { act } = useRuntime();
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [feedback, setFeedback] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus("sending");
    const r = await act({ type: "guestbook", message: message.trim(), name: name.trim(), sectionId: section.id });
    setStatus(r.ok ? "sent" : "error");
    setFeedback(r.message ?? "");
  };

  return (
    <SectionShell id={section.id} style={section.style} theme={theme} ariaLabel="Livro de recados">
      <SectionTitle eyebrow="sua vez">{section.data.title}</SectionTitle>
      {status === "sent" ? (
        <div className="love-card mx-auto max-w-md p-6 text-center" aria-live="polite">
          <p className="text-4xl" aria-hidden>💌</p>
          <p className="mt-2 text-lg font-semibold">Recado enviado!</p>
          <p className="mt-1 text-sm opacity-80">{feedback || "Só quem criou esta página vai ler."}</p>
        </div>
      ) : (
        <form onSubmit={submit} className="love-card mx-auto max-w-md space-y-3 p-6">
          <label className="block text-sm opacity-85" htmlFor={`gb-${section.id}`}>{section.data.prompt}</label>
          <textarea
            id={`gb-${section.id}`}
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
            rows={4}
            required
            className="w-full rounded-[calc(var(--radius)*0.6)] border border-[var(--c-border)] bg-transparent p-3 text-[var(--c-text)] outline-none focus:border-[var(--c-primary)]"
            placeholder="Escreva aqui..."
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            aria-label="Seu nome (opcional)"
            placeholder="Seu nome (opcional)"
            className="w-full rounded-[calc(var(--radius)*0.6)] border border-[var(--c-border)] bg-transparent p-2.5 text-[var(--c-text)] outline-none focus:border-[var(--c-primary)]"
          />
          <p className="text-right text-xs opacity-50">{message.length}/1000</p>
          {status === "error" ? <p className="text-sm text-red-500">{feedback || "Não foi possível enviar. Tente de novo."}</p> : null}
          <button type="submit" disabled={status === "sending" || !message.trim()} className="w-full rounded-full bg-[var(--c-primary)] py-3 font-semibold text-white disabled:opacity-50">
            {status === "sending" ? "Enviando..." : "Enviar recado 💌"}
          </button>
        </form>
      )}
    </SectionShell>
  );
}
