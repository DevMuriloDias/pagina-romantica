"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { api } from "@/lib/client/api";

export function MyPagesForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  if (state === "sent") return <Alert tone="success" className="mt-4">Se houver páginas com este e-mail, você vai receber um link de acesso em instantes. Confira também o spam. 💌</Alert>;
  return (
    <form
      className="mt-4 flex flex-col gap-2 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        try {
          await api("/api/my-pages/request", { body: { email } });
          setState("sent");
        } catch (err) {
          setMsg(err instanceof Error ? err.message : "Erro");
          setState("error");
        }
      }}
    >
      <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" aria-label="E-mail" autoComplete="email" />
      <Button type="submit" disabled={state === "sending"}>{state === "sending" ? "Enviando..." : "Receber link"}</Button>
      {state === "error" ? <Alert tone="danger">{msg}</Alert> : null}
    </form>
  );
}
