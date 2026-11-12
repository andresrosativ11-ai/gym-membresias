# Publicar en internet (Vercel + Neon)

Todo es gratis para empezar. Necesitas solo tu cuenta de GitHub.

## 1. Crear el proyecto en Vercel

1. Entra a https://vercel.com/signup y elige **Continue with GitHub**.
2. **Add New… → Project** → importa `gym-membresias`.
3. **Todavía no pulses Deploy.** Primero abre **Environment Variables** y agrega:

| Variable | Valor |
| --- | --- |
| `AUTH_SECRET` | Texto aleatorio largo. En la Terminal: `openssl rand -base64 32` |
| `CRON_SECRET` | Otro texto aleatorio (mismo comando) |
| `SEED_ADMIN_EMAIL` | Tu correo; será el usuario administrador |
| `SEED_ADMIN_PASSWORD` | Tu contraseña de administrador (mínimo 10 caracteres) |

## 2. Crear la base de datos (Neon)

1. En el proyecto de Vercel: **Storage → Create Database → Neon (Postgres)**.
2. Región: **US East (Washington, D.C.)**, la más cercana a Venezuela.
3. Conéctala al proyecto. Vercel crea solas `DATABASE_URL` y `DATABASE_URL_UNPOOLED`.

## 3. Publicar

**Deployments → Redeploy** (o el botón **Deploy** si aún no lo pulsaste).

Durante la publicación se ejecuta automáticamente (`vercel-build` en `package.json`):
1. `prisma migrate deploy` crea las tablas.
2. `prisma/seed.ts` crea tu usuario admin, los beneficios y 3 planes de ejemplo en dólares.
3. `next build` compila la app.

Si falla con *"Configura SEED_ADMIN_PASSWORD"*, revisa el paso 1.3.

## 4. Primer ingreso

1. Abre la dirección que te da Vercel (ej. `gym-membresias.vercel.app`) e ingresa con tu correo y contraseña.
2. En **Ajustes** revisa el nombre del gimnasio, la moneda (USD) y la zona horaria (Caracas).
3. Edita los planes de ejemplo con tus precios reales.
4. En el celular: abre la dirección en Chrome o Safari → **Agregar a pantalla de inicio**.

## Después

- Cada `git push` a `main` publica la nueva versión automáticamente.
- El aviso diario corre a las 9:00 de Caracas (`vercel.json`). Para que envíe de verdad, sigue `docs/whatsapp.md` y `docs/email.md` y agrega esas variables en Vercel.
