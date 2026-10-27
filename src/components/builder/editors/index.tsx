"use client";
import type { ComponentType } from "react";
import type { SectionType } from "@/lib/content/schema";
import { CouponsEditor, LettersEditor, PhotosEditor, PlacesEditor, QuizEditor, ReasonsEditor, SkyEditor, TimelineEditor } from "./collections";
import { CounterEditor, CountdownEditor, FinaleEditor, GuestbookEditor, HeroEditor, ProposalEditor, ScratchEditor, VideoEditor } from "./simple";
import type { EditorProps } from "./types";

/** Editores de cada módulo (o TypeScript exige um para cada tipo do registro). */
export const sectionEditors: { [K in SectionType]: ComponentType<EditorProps<K>> } = {
  hero: HeroEditor,
  letters: LettersEditor,
  photos: PhotosEditor,
  timeline: TimelineEditor,
  places: PlacesEditor,
  counter: CounterEditor,
  countdown: CountdownEditor,
  reasons: ReasonsEditor,
  sky: SkyEditor,
  quiz: QuizEditor,
  scratch: ScratchEditor,
  coupons: CouponsEditor,
  proposal: ProposalEditor,
  video: VideoEditor,
  finale: FinaleEditor,
  guestbook: GuestbookEditor,
};
