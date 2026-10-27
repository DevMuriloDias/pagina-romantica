"use client";
import { cn } from "@/lib/utils";

/** Botão de submit com confirmação (ações destrutivas do admin). */
export function ConfirmSubmit({ children, message, tone = "danger" }: { children: React.ReactNode; message: string; tone?: "default" | "danger" }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
      className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", tone === "danger" ? "border-red-200 text-red-700 hover:bg-red-50" : "border-line hover:bg-ink/5")}
    >
      {children}
    </button>
  );
}
