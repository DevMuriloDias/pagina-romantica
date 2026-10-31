import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { hmac, safeEqual } from "./crypto";
import { env } from "./env";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type UploadTarget =
  | { kind: "post"; url: string; fields: Record<string, string> }
  | { kind: "put"; url: string; headers: Record<string, string> };

const LOCAL_DIR = path.join(process.cwd(), ".uploads");

let s3: S3Client | null = null;
function client(): S3Client {
  if (s3) return s3;
  const e = env();
  if (!e.S3_BUCKET || !e.S3_ACCESS_KEY_ID || !e.S3_SECRET_ACCESS_KEY) throw new Error("S3 não configurado (S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY).");
  s3 = new S3Client({
    region: e.S3_REGION,
    endpoint: e.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(e.S3_ENDPOINT),
    credentials: { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY },
    // O SDK novo adiciona checksum CRC32 por padrão; em URL pré-assinada ele seria o do corpo
    // vazio e o Cloudflare R2 recusa o upload (403). Só calculamos quando a API exigir.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return s3;
}

const isLocal = () => env().STORAGE_DRIVER === "local";

function safeKey(key: string) {
  if (!/^[a-zA-Z0-9/_.-]+$/.test(key) || key.includes("..")) throw new Error("Chave de arquivo inválida");
  return key;
}

export function publicUrl(key: string): string {
  if (isLocal()) return `/api/uploads/${safeKey(key)}`;
  const base = env().S3_PUBLIC_URL;
  if (!base) throw new Error("S3_PUBLIC_URL não configurada");
  return `${base.replace(/\/$/, "")}/${safeKey(key)}`;
}

export function localUploadSignature(key: string, contentType: string, exp: number) {
  return hmac(`upload:${key}:${contentType}:${exp}`);
}

export function verifyLocalUpload(key: string, contentType: string, exp: number, sig: string) {
  return exp > Date.now() / 1000 && safeEqual(sig, localUploadSignature(key, contentType, exp));
}

/**
 * URL pré-assinada (PUT) para upload direto do navegador — o arquivo não passa pelo nosso servidor.
 * Usamos PUT porque o Cloudflare R2 não implementa o POST de formulário do S3.
 * Tipo e tamanho entram na assinatura: o storage recusa um envio diferente do declarado.
 */
export async function presignUpload(key: string, contentType: string, size: number): Promise<UploadTarget> {
  safeKey(key);
  if (size <= 0 || size > MAX_UPLOAD_BYTES) throw new Error("Tamanho de arquivo inválido");
  if (isLocal()) {
    const exp = Math.floor(Date.now() / 1000) + 600;
    const qs = new URLSearchParams({ key, ct: contentType, exp: String(exp), sig: localUploadSignature(key, contentType, exp) });
    return { kind: "put", url: `/api/uploads/local?${qs}`, headers: { "Content-Type": contentType } };
  }
  const url = await getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: env().S3_BUCKET!, Key: key, ContentType: contentType, ContentLength: size }),
    { expiresIn: 600, signableHeaders: new Set(["content-type", "content-length"]) },
  );
  return { kind: "put", url, headers: { "Content-Type": contentType } };
}

export async function getObject(key: string): Promise<Buffer | null> {
  safeKey(key);
  if (isLocal()) {
    try {
      return await readFile(path.join(LOCAL_DIR, key));
    } catch {
      return null;
    }
  }
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: env().S3_BUCKET!, Key: key }));
    const bytes = await res.Body?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  } catch {
    return null;
  }
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  safeKey(key);
  if (isLocal()) {
    const file = path.join(LOCAL_DIR, key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return;
  }
  await client().send(
    new PutObjectCommand({ Bucket: env().S3_BUCKET!, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }),
  );
}

export async function deleteObject(key: string) {
  safeKey(key);
  if (isLocal()) {
    await rm(path.join(LOCAL_DIR, key), { force: true });
    return;
  }
  await client().send(new DeleteObjectCommand({ Bucket: env().S3_BUCKET!, Key: key }));
}

export async function deletePrefix(keys: string[]) {
  await Promise.allSettled(keys.map((k) => deleteObject(k)));
}
