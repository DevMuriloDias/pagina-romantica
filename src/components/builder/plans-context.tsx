"use client";
import { createContext, useContext } from "react";

export interface PlansInfo {
  premiumSections: Set<string>;
  basePlanName: string;
  topPlanName: string;
  basePhotos: number;
  topPhotos: number;
  baseLetters: number | null;
}

const Ctx = createContext<PlansInfo>({ premiumSections: new Set(), basePlanName: "Essencial", topPlanName: "Premium", basePhotos: 10, topPhotos: 50, baseLetters: 3 });
export const PlansProvider = Ctx.Provider;
export const usePlans = () => useContext(Ctx);
