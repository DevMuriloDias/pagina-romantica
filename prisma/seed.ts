/**
 * Seed de exemplo: planos, templates, cupom e admin inicial.
 * ⚠️ PREÇOS SÃO PLACEHOLDERS — defina os valores reais no painel /admin/planos.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { TEMPLATES } from "../src/lib/theme/templates";

const db = new PrismaClient();

const ESSENTIAL_SECTIONS = ["hero", "letters", "photos", "timeline", "places", "counter", "countdown", "reasons", "finale"];

async function main() {
  const plans: Prisma.PlanCreateInput[] = [
    {
      slug: "essencial",
      name: "Essencial",
      description: "Tudo o que você precisa para uma surpresa linda.",
      priceCents: 1990, // PLACEHOLDER — defina o preço real no admin
      sortOrder: 1,
      limits: { maxPhotos: 10, maxLetters: 3, sections: ESSENTIAL_SECTIONS, durationDays: 365, customSlug: false, music: true, removeBranding: false },
    },
    {
      slug: "premium",
      name: "Premium",
      description: "Todos os módulos, fotos à vontade e página para sempre.",
      priceCents: 3990, // PLACEHOLDER — defina o preço real no admin
      sortOrder: 2,
      highlight: true,
      limits: { maxPhotos: 50, maxLetters: null, sections: "all", durationDays: null, customSlug: true, music: true, removeBranding: false },
    },
  ];
  for (const p of plans) {
    await db.plan.upsert({ where: { slug: p.slug }, update: {}, create: p });
  }

  for (const [i, t] of TEMPLATES.entries()) {
    await db.template.upsert({
      where: { id: t.id },
      update: { name: t.name, description: t.description, theme: t.theme as unknown as Prisma.InputJsonValue },
      create: { id: t.id, name: t.name, description: t.description, theme: t.theme as unknown as Prisma.InputJsonValue, sortOrder: i },
    });
  }

  await db.coupon.upsert({
    where: { code: "BEMVINDO10" },
    update: {},
    create: { code: "BEMVINDO10", type: "PERCENT", value: 10, maxUses: 1000 },
  });

  const email = (process.env.ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
  const envPassword = process.env.ADMIN_PASSWORD?.trim();
  const passwordHash = await bcrypt.hash(envPassword || "troque-esta-senha", 12);
  // ADMIN_PASSWORD na Vercel é a fonte da verdade: trocar a variável e fazer redeploy redefine a senha.
  await db.adminUser.upsert({
    where: { email },
    update: envPassword ? { passwordHash } : {},
    create: { email, name: "Admin", passwordHash },
  });

  console.log(`Seed concluído: ${plans.length} planos (preços PLACEHOLDER), ${TEMPLATES.length} templates, cupom BEMVINDO10, admin ${email}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
