import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, tone = "default", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "premium" | "success" | "warning" | "muted" | "danger" }) {
  const tones = {
    default: "bg-blush text-rose-deep",
    premium: "bg-gradient-to-r from-amber-200 to-yellow-100 text-amber-900 ring-1 ring-amber-300/60",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-900",
    muted: "bg-ink/5 text-ink-soft",
    danger: "bg-red-100 text-red-800",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide", tones[tone], className)} {...props} />;
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line bg-white/80 p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)]", className)} {...props} />;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent", className)} aria-hidden />;
}

export function Alert({ tone = "info", children, className }: { tone?: "info" | "warning" | "danger" | "success"; children: React.ReactNode; className?: string }) {
  const tones = {
    info: "bg-sky-50 text-sky-900 border-sky-200",
    warning: "bg-amber-50 text-amber-900 border-amber-200",
    danger: "bg-red-50 text-red-900 border-red-200",
    success: "bg-emerald-50 text-emerald-900 border-emerald-200",
  };
  return <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-xl border px-3.5 py-2.5 text-sm leading-snug", tones[tone], className)}>{children}</div>;
}
