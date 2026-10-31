import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";
import { client, normalizeEndpoint, publicUrl } from "./storage";

export interface CheckStep {
  name: string;
  ok: boolean;
  detail: string;
}

function mask(v: string | undefined) {
  if (!v) return "(vazio)";
  return v.length <= 8 ? "****" : `${v.slice(0, 4)}…${v.slice(-4)} (${v.length} caracteres)`;
}

function explain(err: unknown): string {
  const e = err as { name?: string; Code?: string; message?: string; $metadata?: { httpStatusCode?: number } };
  const code = e.Code ?? e.name ?? "Erro";
  const hints: Record<string, string> = {
    InvalidAccessKeyId: "O S3_ACCESS_KEY_ID não existe no Cloudflare. Copie de novo o Access Key ID do token.",
    SignatureDoesNotMatch: "O S3_SECRET_ACCESS_KEY não corresponde ao Access Key ID. Crie um token novo e copie os dois valores juntos.",
    AccessDenied: "O token não tem permissão neste bucket. Ele precisa de “Object Read & Write” no bucket do S3_BUCKET.",
    NoSuchBucket: "O bucket do S3_BUCKET não existe nesta conta (confira o nome exato).",
    Unauthorized: "Credenciais recusadas. Confira S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY.",
  };
  return `${code}${e.$metadata?.httpStatusCode ? ` (HTTP ${e.$metadata.httpStatusCode})` : ""}: ${hints[code] ?? e.message ?? ""}`;
}

/** Diagnóstico do armazenamento, executado pelo servidor (admin). Não expõe as chaves. */
export async function checkStorage(): Promise<{ config: Record<string, string>; steps: CheckStep[] }> {
  const e = env();
  const config = {
    STORAGE_DRIVER: e.STORAGE_DRIVER,
    S3_ENDPOINT: e.S3_ENDPOINT ?? "(vazio)",
    "Endpoint usado": normalizeEndpoint(e.S3_ENDPOINT) ?? "(vazio)",
    S3_REGION: e.S3_REGION,
    S3_BUCKET: e.S3_BUCKET ?? "(vazio)",
    S3_ACCESS_KEY_ID: mask(e.S3_ACCESS_KEY_ID),
    S3_SECRET_ACCESS_KEY: mask(e.S3_SECRET_ACCESS_KEY),
    S3_PUBLIC_URL: e.S3_PUBLIC_URL ?? "(vazio)",
  };
  const steps: CheckStep[] = [];
  if (e.STORAGE_DRIVER !== "s3") {
    steps.push({ name: "Driver", ok: false, detail: "STORAGE_DRIVER não está como “s3”: as fotos estão indo para o disco do servidor (não funciona na Vercel)." });
    return { config, steps };
  }
  const endpoint = normalizeEndpoint(e.S3_ENDPOINT) ?? "";
  steps.push({
    name: "Formato do endpoint",
    ok: /^https:\/\/[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(endpoint) || !endpoint.includes("r2."),
    detail: endpoint ? `Usando ${endpoint}` : "S3_ENDPOINT vazio.",
  });
  if (e.S3_ACCESS_KEY_ID && e.S3_ACCESS_KEY_ID.length !== 32) {
    steps.push({ name: "Formato do Access Key ID", ok: false, detail: `Chaves do R2 têm 32 caracteres; esta tem ${e.S3_ACCESS_KEY_ID.length}. Talvez tenha copiado o “Token value” em vez do Access Key ID.` });
  }
  if (e.S3_SECRET_ACCESS_KEY && e.S3_SECRET_ACCESS_KEY.length !== 64) {
    steps.push({ name: "Formato do Secret Access Key", ok: false, detail: `Segredos do R2 têm 64 caracteres; este tem ${e.S3_SECRET_ACCESS_KEY.length}.` });
  }

  const key = `diagnostico/teste-${Date.now()}.txt`;
  const body = "ok";
  try {
    await client().send(new PutObjectCommand({ Bucket: e.S3_BUCKET!, Key: key, Body: body, ContentType: "text/plain" }));
    steps.push({ name: "Gravar arquivo (servidor)", ok: true, detail: "O servidor conseguiu gravar no bucket." });
  } catch (err) {
    steps.push({ name: "Gravar arquivo (servidor)", ok: false, detail: explain(err) });
    return { config, steps };
  }

  try {
    const url = await getSignedUrl(
      client(),
      new PutObjectCommand({ Bucket: e.S3_BUCKET!, Key: `${key}.put`, ContentType: "text/plain", ContentLength: body.length }),
      { expiresIn: 120, signableHeaders: new Set(["content-type", "content-length"]) },
    );
    const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "text/plain" }, body });
    const text = res.ok ? "" : (await res.text()).slice(0, 300);
    steps.push({ name: "Envio por URL pré-assinada (como o navegador faz)", ok: res.ok, detail: res.ok ? "OK" : `HTTP ${res.status}: ${text}` });
    await client().send(new DeleteObjectCommand({ Bucket: e.S3_BUCKET!, Key: `${key}.put` })).catch(() => {});
  } catch (err) {
    steps.push({ name: "Envio por URL pré-assinada (como o navegador faz)", ok: false, detail: explain(err) });
  }

  try {
    await client().send(new GetObjectCommand({ Bucket: e.S3_BUCKET!, Key: key }));
    steps.push({ name: "Ler arquivo (servidor)", ok: true, detail: "OK" });
  } catch (err) {
    steps.push({ name: "Ler arquivo (servidor)", ok: false, detail: explain(err) });
  }

  if (e.S3_PUBLIC_URL) {
    try {
      const url = publicUrl(key);
      const res = await fetch(url, { cache: "no-store" });
      steps.push({ name: "Ler pela URL pública", ok: res.ok, detail: res.ok ? `OK (${url})` : `HTTP ${res.status} em ${url}. Confira o S3_PUBLIC_URL e se a Public Development URL está ativada.` });
    } catch (err) {
      steps.push({ name: "Ler pela URL pública", ok: false, detail: `Não foi possível acessar o S3_PUBLIC_URL: ${(err as Error).message}` });
    }
  } else {
    steps.push({ name: "Ler pela URL pública", ok: false, detail: "S3_PUBLIC_URL vazio." });
  }

  await client().send(new DeleteObjectCommand({ Bucket: e.S3_BUCKET!, Key: key })).catch(() => {});
  return { config, steps };
}
