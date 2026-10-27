import { cn } from "@/lib/utils";

export function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-line bg-cream/60 text-xs uppercase tracking-wider text-ink-soft">
          <tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-3 py-2.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5 align-top", className)}>{children}</td>;
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-xs uppercase tracking-wider text-ink-soft">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-soft">{hint}</p> : null}
    </div>
  );
}

export function SmallButton({ children, tone = "default", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "default" | "danger" }) {
  return (
    <button {...props} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", tone === "danger" ? "border-red-200 text-red-700 hover:bg-red-50" : "border-line hover:bg-ink/5", props.className)}>
      {children}
    </button>
  );
}

export const field = "h-9 rounded-lg border border-line bg-white px-2.5 text-sm";
