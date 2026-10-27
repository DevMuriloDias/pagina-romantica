"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { PageRenderer } from "@/components/page/PageRenderer";
import type { PageAction, PageRuntime } from "@/components/page/runtime";
import { BRAND } from "@/config";
import type { PageContent } from "@/lib/content/schema";
import type { Theme } from "@/lib/theme/schema";
import { ReportButton } from "./ReportButton";

export function PublicPageClient({ slug, initialContent, theme, locked }: { slug: string; initialContent: PageContent; theme: Theme; locked: boolean }) {
  const [content, setContent] = useState(initialContent);
  const [currentTheme, setTheme] = useState(theme);

  const runtime: PageRuntime = {
    mode: "public",
    act: async (action: PageAction) => {
      try {
        const res = await fetch(`/api/public/${slug}/action`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action) });
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        return { ok: res.ok, message: res.ok ? data.message : data.error };
      } catch {
        return { ok: false, message: "Sem conexão. Tente de novo." };
      }
    },
  };

  const verify = useCallback(
    async (answer: string) => {
      const res = await fetch(`/api/public/${slug}/unlock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answer }) });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string; content?: PageContent; theme?: Theme };
      if (res.ok && data.ok && data.content) {
        setContent(data.content);
        if (data.theme) setTheme(data.theme);
        return { ok: true };
      }
      return { ok: false, message: data.message ?? data.error };
    },
    [slug],
  );

  const onOpened = useCallback(() => {
    try {
      if (sessionStorage.getItem(`aep_opened_${slug}`)) return;
      sessionStorage.setItem(`aep_opened_${slug}`, "1");
    } catch {
      /* modo privado */
    }
    void fetch(`/api/public/${slug}/opened`, { method: "POST" }).catch(() => {});
  }, [slug]);

  return (
    <PageRenderer
      content={content}
      theme={currentTheme}
      runtime={runtime}
      showGate
      verify={locked ? verify : undefined}
      onOpened={onOpened}
      footer={
        <footer className="relative z-[2] px-6 pb-10 pt-6 text-center text-xs opacity-60">
          <p>
            Feito com ♥ no <Link href="/" className="underline">{BRAND.name}</Link> · <ReportButton slug={slug} />
          </p>
        </footer>
      }
    />
  );
}
