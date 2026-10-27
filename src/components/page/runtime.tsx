"use client";
import { createContext, useContext } from "react";

export type PageAction =
  | { type: "proposal"; answer: "yes" | "no"; sectionId: string }
  | { type: "coupon"; couponId: string; title: string; sectionId: string }
  | { type: "guestbook"; message: string; name: string; sectionId: string };

export type ActionResult = { ok: boolean; message?: string };

export interface PageRuntime {
  mode: "preview" | "public";
  /** Executa ações do destinatário (pedido, cupom, recado). No preview é simulado. */
  act: (action: PageAction) => Promise<ActionResult>;
  /** Momento da página (sincroniza contadores e cadeados de data). */
  now?: () => Date;
}

const RuntimeContext = createContext<PageRuntime>({
  mode: "preview",
  act: async () => ({ ok: true, message: "Na página real, você receberia um e-mail com isso 💌" }),
});

export const RuntimeProvider = RuntimeContext.Provider;

export function useRuntime() {
  return useContext(RuntimeContext);
}
