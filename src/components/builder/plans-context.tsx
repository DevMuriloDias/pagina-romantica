"use client";
import { createContext, useContext } from "react";

export interface PlansInfo {
  premiumSections: Set<string>;
  basePlanName: string;
  topPlanName: string;
  basePhotos: number;
  topPhotos: number;
  baseLetters: number | null;
  /** Só existe um plano ativo (sem comparação entre planos no editor). */
  singlePlan: boolean;
  /** IA configurada (ANTHROPIC_API_KEY). Sem ela, os botões de IA ficam ocultos. */
  aiEnabled: boolean;
}

const Ctx = createContext<PlansInfo>({ premiumSections: new Set(), basePlanName: "Essencial", topPlanName: "Premium", basePhotos: 10, topPhotos: 50, baseLetters: 3, singlePlan: false, aiEnabled: false });
export const PlansProvider = Ctx.Provider;
export const usePlans = () => useContext(Ctx);
