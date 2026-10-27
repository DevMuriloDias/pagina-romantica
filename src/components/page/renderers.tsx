"use client";
import type { ComponentType } from "react";
import type { SectionType } from "@/lib/content/schema";
import { Countdown } from "./sections/Countdown";
import { Counter } from "./sections/Counter";
import { Coupons } from "./sections/Coupons";
import { Finale } from "./sections/Finale";
import { Guestbook } from "./sections/Guestbook";
import { Hero } from "./sections/Hero";
import { Letters } from "./sections/Letters";
import { Photos } from "./sections/Photos";
import { Places } from "./sections/Places";
import { Proposal } from "./sections/Proposal";
import { Quiz } from "./sections/Quiz";
import { Reasons } from "./sections/Reasons";
import { Scratch } from "./sections/Scratch";
import { Sky } from "./sections/Sky";
import { Timeline } from "./sections/Timeline";
import { Video } from "./sections/Video";
import type { SectionProps } from "./types";

/** Renderers usados tanto no preview do editor quanto na página pública. */
export const sectionRenderers: { [K in SectionType]: ComponentType<SectionProps<K>> } = {
  hero: Hero,
  letters: Letters,
  photos: Photos,
  timeline: Timeline,
  places: Places,
  counter: Counter,
  countdown: Countdown,
  reasons: Reasons,
  sky: Sky,
  quiz: Quiz,
  scratch: Scratch,
  coupons: Coupons,
  proposal: Proposal,
  video: Video,
  finale: Finale,
  guestbook: Guestbook,
};
