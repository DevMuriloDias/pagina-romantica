import "server-only";
import sharp from "sharp";

export interface ProcessedImage {
  buffer: Buffer;
  width: number;
  height: number;
  mime: "image/webp";
}

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

/**
 * Valida o conteúdo real do arquivo (não confia no MIME do cliente), aplica a orientação
 * e gera WebP sem metadados — o sharp descarta EXIF (inclusive GPS), XMP e ICC por padrão.
 */
export async function processUpload(input: Buffer, maxSide = 2000): Promise<ProcessedImage> {
  const img = sharp(input, { failOn: "error", limitInputPixels: 60_000_000 });
  const meta = await img.metadata();
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) throw new Error("Formato de imagem não suportado");
  const { data, info } = await img
    .rotate()
    .resize({ width: maxSide, height: maxSide, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height, mime: "image/webp" };
}
