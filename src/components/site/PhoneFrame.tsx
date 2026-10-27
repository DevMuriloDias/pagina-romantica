import { cn } from "@/lib/utils";

export function PhoneFrame({ children, className, screenRef }: { children: React.ReactNode; className?: string; screenRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div className={cn("relative mx-auto w-[300px] rounded-[46px] bg-[#1a1416] p-[10px] shadow-[0_40px_80px_-30px_rgba(42,20,24,0.55),inset_0_0_0_2px_#3a2a2e]", className)}>
      <div className="absolute left-1/2 top-[18px] z-20 h-[22px] w-[90px] -translate-x-1/2 rounded-full bg-[#1a1416]" aria-hidden />
      <div ref={screenRef} className="relative h-[600px] overflow-y-auto overflow-x-hidden rounded-[36px] bg-white [scrollbar-width:none] [transform:translateZ(0)]">
        {children}
      </div>
    </div>
  );
}
