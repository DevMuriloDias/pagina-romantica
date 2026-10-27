"use client";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <p className="text-6xl" aria-hidden>🥺</p>
      <h1 className="mt-6 font-display text-4xl">Ops, algo deu errado</h1>
      <p className="mt-3 max-w-md text-ink-soft">Não se preocupe: o que você já fez está salvo. Tente de novo em instantes.</p>
      {error.digest ? <p className="mt-2 text-xs text-ink-soft/60">Código: {error.digest}</p> : null}
      <Button className="mt-8" onClick={reset}>Tentar de novo</Button>
    </main>
  );
}
