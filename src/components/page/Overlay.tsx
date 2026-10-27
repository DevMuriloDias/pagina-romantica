"use client";
import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Camada de sobreposição presa à ÁREA VISÍVEL (viewport na página pública, tela do celular no preview).
 * Janelas como a tela de entrada, a carta aberta e a foto ampliada são renderizadas aqui —
 * assim aparecem onde a pessoa está olhando, e não no topo da página.
 */
const OverlayContext = createContext<HTMLElement | null>(null);
export const OverlayProvider = OverlayContext.Provider;

export function Overlay({ children }: { children: ReactNode }) {
  const layer = useContext(OverlayContext);
  if (!layer) return null;
  return createPortal(children, layer);
}
