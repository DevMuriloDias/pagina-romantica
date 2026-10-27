import { z } from "zod";
import { ApiError, json, parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { processUpload } from "@/lib/images";
import { log } from "@/lib/log";
import { requireEditablePage } from "@/lib/pages/access";
import { deleteObject, getObject, MAX_UPLOAD_BYTES, publicUrl, putObject } from "@/lib/storage";

export const maxDuration = 30;

/**
 * Etapa 2 do upload: valida o arquivo real (tipo e tamanho), remove EXIF/GPS,
 * gera WebP otimizado e apaga o original.
 */
export const POST = route(async (req: Request) => {
  const { assetId } = await parseBody(req, z.object({ assetId: z.string().min(1).max(40) }));
  const asset = await db.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw new ApiError(404, "Foto não encontrada.", "not_found");
  await requireEditablePage(asset.pageId);
  if (asset.status === "READY") return json({ assetId: asset.id, url: asset.url, width: asset.width, height: asset.height });

  const raw = await getObject(asset.key);
  if (!raw) throw new ApiError(400, "O envio da foto não foi concluído. Tente de novo.", "missing_upload");
  if (raw.length > MAX_UPLOAD_BYTES) {
    await deleteObject(asset.key);
    throw new ApiError(400, "A foto é grande demais (máximo 10 MB).", "too_large");
  }
  let processed;
  try {
    processed = await processUpload(raw);
  } catch (err) {
    log.warn("upload.invalid_image", { assetId, err });
    await deleteObject(asset.key);
    await db.asset.delete({ where: { id: asset.id } });
    throw new ApiError(400, "Não conseguimos ler esta imagem. Envie uma foto JPG, PNG ou WebP.", "invalid_image");
  }
  const finalKey = `pages/${asset.pageId}/${asset.id}.webp`;
  await putObject(finalKey, processed.buffer, processed.mime);
  await deleteObject(asset.key).catch(() => {});
  const url = publicUrl(finalKey);
  await db.asset.update({
    where: { id: asset.id },
    data: { key: finalKey, url, mime: processed.mime, size: processed.buffer.length, width: processed.width, height: processed.height, status: "READY" },
  });
  return json({ assetId: asset.id, url, width: processed.width, height: processed.height });
});
