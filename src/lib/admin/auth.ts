import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signToken, verifyToken } from "../crypto";
import { db } from "../db";
import { env } from "../env";

const COOKIE = "aep_admin";
const TTL = 12 * 3600;
// hash válido de uma senha qualquer, usado quando o e-mail não existe (tempo constante)
const DUMMY_HASH = "$2b$12$9zqAduegiH5yA8J.wCiO/.eJl7FPvyf1e.Cy/jf0C6pkNsBiMRCCm";

export async function adminLogin(email: string, password: string): Promise<boolean> {
  const user = await db.adminUser.findUnique({ where: { email: email.trim().toLowerCase() } });
  // compara mesmo sem usuário para não vazar existência pelo tempo de resposta
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return false;
  (await cookies()).set(COOKIE, signToken("admin", { id: user.id }, TTL), {
    httpOnly: true,
    secure: env().NODE_ENV === "production",
    sameSite: "strict",
    path: "/admin",
    maxAge: TTL,
  });
  return true;
}

export async function adminLogout() {
  (await cookies()).set(COOKIE, "", { path: "/admin", maxAge: 0 });
}

export async function getAdmin() {
  const data = verifyToken<{ id: string }>("admin", (await cookies()).get(COOKIE)?.value);
  if (!data) return null;
  return db.adminUser.findUnique({ where: { id: data.id }, select: { id: true, email: true, name: true } });
}

/** Use no topo de páginas e server actions do admin. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
