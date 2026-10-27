import { Fragment } from "react";

/**
 * Renderiza texto do usuário preservando quebras de linha.
 * Nunca usa HTML livre: o React escapa todo o conteúdo (proteção contra XSS).
 */
export function SafeText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/\n/);
  return (
    <span className={className}>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {p}
          {i < parts.length - 1 ? <br /> : null}
        </Fragment>
      ))}
    </span>
  );
}

export function Paragraphs({ text, className }: { text: string; className?: string }) {
  const paras = text.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <div className={className}>
      {paras.map((p, i) => (
        <p key={i} className="mb-4 last:mb-0">
          <SafeText text={p} />
        </p>
      ))}
    </div>
  );
}
