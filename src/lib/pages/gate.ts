import "server-only";
import bcrypt from "bcryptjs";
import { normalizeAnswer, normalizePassword } from "../gate";

export async function checkGateAnswer(hashes: string[], mode: string, answer: string): Promise<boolean> {
  if (mode === "none") return true;
  const normalized = mode === "password" ? normalizePassword(answer) : normalizeAnswer(answer);
  if (!normalized) return false;
  for (const h of hashes) if (await bcrypt.compare(normalized, h)) return true;
  return false;
}
