import { z } from "zod";
import { ApiError, clientIp, enforceRate, json, parseBody, route } from "@/lib/api";
import { db } from "@/lib/db";
import { requireEditablePage } from "@/lib/pages/access";
import { LIMITS } from "@/lib/ratelimit";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, presignUpload } from "@/lib/storage";
import { uid } from "@/lib/utils";

const MAX_ASSETS_PER_PAGE = 200;

const Schema = z.object({
  pageId: z.string().min(1).max(40),
  contentType: z.enum(ALLOWED_UPLOAD_TYPES, { errorMap: () => ({ message: "Envie fotos em JPG, PNG ou WebP." }) }),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, "A foto é grande demais (máximo 10 MB)."),
});

/** Etapa 1 do upload: URL pré-assinada para envio direto ao storage. */
export const POST = route(async (req: Request) => {
  const body = await parseBody(req, Schema);
  const page = await requireEditablePage(body.pageId);
  await enforceRate("upload", await clientIp(), LIMITS.upload.limit, LIMITS.upload.window);
  const count = await db.asset.count({ where: { pageId: page.id } });
  if (count >= MAX_ASSETS_PER_PAGE) throw new ApiError(400, "Limite de fotos enviadas para esta página atingido.", "too_many_assets");
  const assetId = uid("a");
  const key = `pages/${page.id}/raw/${assetId}`;
  const upload = await presignUpload(key, body.contentType, body.size);
  await db.asset.create({ data: { id: assetId, pageId: page.id, key, url: "", mime: body.contentType, size: body.size, status: "PENDING" } });
  return json({ assetId, upload });
});
