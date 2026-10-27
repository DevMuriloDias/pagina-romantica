import { z } from "zod";
import { clientIp, enforceRate, json, route } from "@/lib/api";
import { env } from "@/lib/env";
import { log } from "@/lib/log";
import { LIMITS, rateLimit } from "@/lib/ratelimit";

const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 7 * 86_400_000;

const NominatimItem = z.object({ display_name: z.string(), lat: z.string(), lon: z.string() });

/**
 * Busca de endereço via Nominatim (OpenStreetMap), com cache e rate limit.
 * A política de uso do Nominatim exige no máximo 1 requisição/s e User-Agent identificável.
 */
export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 160) ?? "";
  if (q.length < 3) return json({ results: [] });
  await enforceRate("geocode-ip", await clientIp(), LIMITS.geocode.limit, LIMITS.geocode.window);
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return json({ results: hit.data, cached: true });

  // limite global de 1 req/s para respeitar o Nominatim
  const global = await rateLimit("nominatim-global", "all", 1, 1);
  if (!global.ok) await new Promise((r) => setTimeout(r, 1100));

  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q, format: "json", limit: "5", "accept-language": "pt-BR" })}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": env().NOMINATIM_USER_AGENT }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = z.array(NominatimItem).parse(await res.json());
    const results = data.map((d) => ({ label: d.display_name, lat: Number(d.lat), lng: Number(d.lon) }));
    cache.set(key, { at: Date.now(), data: results });
    if (cache.size > 5000) cache.delete(cache.keys().next().value!);
    return json({ results });
  } catch (err) {
    log.warn("geocode.error", { err });
    return json({ results: [], error: "Busca de endereços indisponível agora. Tente de novo em instantes." }, { status: 200 });
  }
});
