import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@gym.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "cambiar-esta-clave";

  await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Administrador", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
  });

  const benefits = [
    { key: "gym", label: "Área de pesas y cardio" },
    { key: "classes", label: "Clases grupales" },
    { key: "locker", label: "Casillero" },
    { key: "towel", label: "Toalla" },
  ];
  for (const b of benefits) {
    await db.benefit.upsert({ where: { key: b.key }, update: {}, create: b });
  }

  if ((await db.plan.count()) === 0) {
    const all = await db.benefit.findMany();
    const id = (key: string) => all.find((b) => b.key === key)!.id;
    await db.plan.create({
      data: {
        name: "Mensual",
        durationMonths: 1,
        priceCents: 50000,
        benefits: { create: [{ benefitId: id("gym") }] },
      },
    });
    await db.plan.create({
      data: {
        name: "Trimestral",
        durationMonths: 3,
        priceCents: 135000,
        benefits: { create: [{ benefitId: id("gym") }, { benefitId: id("classes"), value: "8 clases/mes" }] },
      },
    });
    await db.plan.create({
      data: {
        name: "Anual",
        durationMonths: 12,
        priceCents: 480000,
        benefits: {
          create: [{ benefitId: id("gym") }, { benefitId: id("classes") }, { benefitId: id("locker") }],
        },
      },
    });
  }

  console.log(`Seed listo. Admin: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
