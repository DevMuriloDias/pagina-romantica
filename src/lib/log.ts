/** Logger estruturado (JSON por linha) — compatível com Vercel/Datadog/Logtail. */
type Level = "debug" | "info" | "warn" | "error";

function write(level: Level, msg: string, ctx?: Record<string, unknown>) {
  if (level === "debug" && process.env.NODE_ENV === "production") return;
  const entry = {
    level,
    msg,
    time: new Date().toISOString(),
    ...serialize(ctx),
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function serialize(ctx?: Record<string, unknown>) {
  if (!ctx) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    out[k] = v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v;
  }
  return out;
}

export const log = {
  debug: (msg: string, ctx?: Record<string, unknown>) => write("debug", msg, ctx),
  info: (msg: string, ctx?: Record<string, unknown>) => write("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => write("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => write("error", msg, ctx),
};
