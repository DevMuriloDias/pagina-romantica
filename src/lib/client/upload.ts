"use client";
import imageCompression from "browser-image-compression";
import type { ImageRef } from "@/lib/content/schema";
import { api } from "./api";

type UploadTarget = { kind: "post"; url: string; fields: Record<string, string> } | { kind: "put"; url: string; headers: Record<string, string> };

/**
 * Comprime e redimensiona no navegador (WebP, máx. 2000px), envia direto ao storage
 * via URL pré-assinada e pede ao servidor para validar/remover EXIF.
 */
export async function uploadImage(pageId: string, input: File | Blob, alt = ""): Promise<ImageRef> {
  const file = input instanceof File ? input : new File([input], "foto.webp", { type: input.type || "image/webp" });
  if (!/^image\//.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) throw new Error("Escolha um arquivo de imagem.");
  let compressed: Blob = file;
  try {
    compressed = await imageCompression(file, { maxWidthOrHeight: 2000, maxSizeMB: 2, fileType: "image/webp", initialQuality: 0.85, useWebWorker: false });
  } catch {
    // alguns formatos (ex.: HEIC em navegadores sem suporte) não comprimem; o servidor valida
  }
  const contentType = ["image/jpeg", "image/png", "image/webp"].includes(compressed.type) ? compressed.type : "image/jpeg";
  const { assetId, upload } = await api<{ assetId: string; upload: UploadTarget }>("/api/uploads/presign", {
    body: { pageId, contentType, size: compressed.size },
  });
  let res: Response;
  if (upload.kind === "post") {
    const form = new FormData();
    Object.entries(upload.fields).forEach(([k, v]) => form.append(k, v));
    form.append("file", compressed);
    res = await fetch(upload.url, { method: "POST", body: form });
  } else {
    res = await fetch(upload.url, { method: "PUT", headers: upload.headers, body: compressed });
  }
  if (!res.ok) throw new Error("Falha ao enviar a foto. Verifique sua conexão.");
  const done = await api<{ assetId: string; url: string; width: number; height: number }>("/api/uploads/complete", { body: { assetId } });
  return { assetId: done.assetId, url: done.url, width: done.width, height: done.height, alt };
}

/**
 * Para ler os pixels (recorte, paleta) a imagem precisa vir do nosso domínio:
 * fotos do bucket passam pelo proxy /api/uploads/proxy.
 */
export function sameOriginImageUrl(src: string): string {
  if (src.startsWith("/")) return src;
  return `/api/uploads/proxy?src=${encodeURIComponent(src)}`;
}

/** Recorta uma imagem (por URL) em canvas e devolve um Blob WebP. */
export async function cropImage(src: string, crop: { x: number; y: number; w: number; h: number }, maxSide = 2000): Promise<Blob> {
  const img = new Image();
  img.src = sameOriginImageUrl(src);
  await img.decode();
  const sx = crop.x * img.naturalWidth;
  const sy = crop.y * img.naturalHeight;
  const sw = crop.w * img.naturalWidth;
  const sh = crop.h * img.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Não foi possível recortar"))), "image/webp", 0.88));
}
