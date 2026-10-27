import { ApiError, json, route } from "@/lib/api";
import { env } from "@/lib/env";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, putObject, verifyLocalUpload } from "@/lib/storage";

/** Recebe uploads no modo STORAGE_DRIVER=local (simula a URL pré-assinada do S3). */
export const PUT = route(async (req: Request) => {
  if (env().STORAGE_DRIVER !== "local") throw new ApiError(404, "Não encontrado", "not_found");
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  const ct = url.searchParams.get("ct") ?? "";
  const exp = Number(url.searchParams.get("exp"));
  const sig = url.searchParams.get("sig") ?? "";
  if (!verifyLocalUpload(key, ct, exp, sig)) throw new ApiError(403, "Assinatura inválida ou expirada.", "forbidden");
  if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(ct) || req.headers.get("content-type") !== ct) throw new ApiError(400, "Tipo de arquivo inválido.", "bad_type");
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_UPLOAD_BYTES) throw new ApiError(413, "Arquivo grande demais.", "too_large");
  await putObject(key, buf, ct);
  return json({ ok: true });
});
