"use client";
import * as LabelPrimitive from "@radix-ui/react-label";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn("text-sm font-medium text-ink leading-none", className)} {...props} />
));
Label.displayName = "Label";

/** Campo com rótulo, ajuda curta e exemplo — padrão do builder (amigável para leigos). */
export function Field({
  label,
  help,
  htmlFor,
  children,
  className,
  aside,
}: {
  label: string;
  help?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {aside}
      </div>
      {children}
      {help ? <p className="text-xs text-ink-soft/80 leading-snug">{help}</p> : null}
    </div>
  );
}
