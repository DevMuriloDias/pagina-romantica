"use client";
import { useEffect, useRef } from "react";
import { api, ClientApiError } from "@/lib/client/api";
import { useBuilder } from "@/stores/builder";

const DEBOUNCE_MS = 1200;

/** Autosave com debounce: cada alteração é salva no servidor ~1s depois que a pessoa para de digitar. */
export function useAutosave() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef(false);

  useEffect(() => {
    const save = async () => {
      const s = useBuilder.getState();
      if (inflight.current || s.version === s.savedVersion || !s.pageId) return;
      inflight.current = true;
      const version = s.markSaving();
      try {
        await api(`/api/pages/${s.pageId}`, { method: "PUT", body: { content: s.content, theme: s.theme } });
        useBuilder.getState().markSaved(version);
      } catch (err) {
        const msg = err instanceof ClientApiError ? err.message : "Sem conexão. Tentando de novo...";
        useBuilder.getState().markError(msg);
        // erros de validação/limite não adiantam repetir sem mudança; rede sim
        if (!(err instanceof ClientApiError) || err.status >= 500) timer.current = setTimeout(save, 5000);
      } finally {
        inflight.current = false;
        const now = useBuilder.getState();
        if (now.version !== now.savedVersion && now.saveState !== "error") schedule();
      }
    };
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(save, DEBOUNCE_MS);
    };
    const unsub = useBuilder.subscribe((s, prev) => {
      if (s.version !== prev.version) schedule();
    });
    const flush = () => {
      const s = useBuilder.getState();
      if (s.version === s.savedVersion || !s.pageId) return;
      void fetch(`/api/pages/${s.pageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: s.content, theme: s.theme }),
        keepalive: true,
      });
    };
    const onHide = () => document.visibilityState === "hidden" && flush();
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, []);
}
