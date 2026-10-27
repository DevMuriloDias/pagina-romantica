import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-xl border border-input bg-white px-3.5 py-2 text-[15px] text-ink placeholder:text-ink-soft/50 transition-colors focus-visible:outline-none focus-visible:border-rose focus-visible:ring-2 focus-visible:ring-rose/20 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[96px] w-full rounded-xl border border-input bg-white px-3.5 py-2.5 text-[15px] leading-relaxed text-ink placeholder:text-ink-soft/50 focus-visible:outline-none focus-visible:border-rose focus-visible:ring-2 focus-visible:ring-rose/20 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-10 w-full appearance-none rounded-xl border border-input bg-white bg-[length:16px] bg-[right_12px_center] bg-no-repeat px-3.5 pr-9 text-[15px] text-ink focus-visible:outline-none focus-visible:border-rose focus-visible:ring-2 focus-visible:ring-rose/20",
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b4c52' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")]",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
NativeSelect.displayName = "NativeSelect";
