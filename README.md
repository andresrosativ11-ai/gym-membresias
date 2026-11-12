# Gym · Control de membresías

App web (PWA, pensada para el celular de recepción) para gestionar socios, planes y control de acceso.

**Stack:** Next.js 15 (App Router) · TypeScript · PostgreSQL + Prisma · Auth.js · Tailwind · Vitest

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Base del proyecto, auth con roles, layout móvil, PWA | ✅ |
| 1 (MVP) | Socios (alta/edición/baja/suspensión, foto, QR), planes y beneficios, asignar plan con vencimiento automático, check-in por QR / código / búsqueda | ✅ |
| 2 | Cobro + renovación (método, referencia, confirmación), anulación auditable, panel Inicio (por vencer / vencidos + WhatsApp manual), reportes (ingresos, métodos, planes, asistencia, horas pico, CSV), ajustes (zona horaria, moneda, días de aviso) y gestión de personal | ✅ |
| 3a | Avisos automáticos por **WhatsApp** (por vencer / vencida), consentimiento por socio, cron diario, vista previa, historial — ver [docs/whatsapp.md](docs/whatsapp.md) | ✅ (requiere cuenta de Meta) |
| 3b | Avisos por **email** (Resend), mismo motor que WhatsApp, consentimiento por canal — ver [docs/email.md](docs/email.md) | ✅ (requiere cuenta de Resend) |

## Puesta en marcha (local)

```bash
npm install
cp .env.example .env          # completar AUTH_SECRET (openssl rand -base64 32)
npm run db:dev                # Postgres local sin Docker (prisma dev)
npx prisma migrate deploy     # aplica migraciones
npm run db:seed               # admin + planes de ejemplo
npm run dev                   # http://localhost:3000
```

Usuario inicial: el definido en `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

> El escaneo de QR con la cámara requiere **HTTPS** en el celular (en `localhost` funciona sin él).
> Para probar desde el teléfono en la red local usa un túnel HTTPS o despliega.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas unitarias del dominio (fechas, estados, acceso, búsqueda) |
| `npm run typecheck` | TypeScript sin emitir |
| `npm run lint` | ESLint |
| `npm run build` | Build de producción |
| `npm run db:migrate` | Nueva migración (desarrollo) |

## Decisiones de diseño

- **El estado del socio se calcula, no se guarda.** `Baja > Suspendido > Sin membresía > Vencido > Por vencer > Activo`, a partir de `currentEndDate` (desnormalizado para filtrar rápido) y la fecha de hoy en la **zona horaria del gimnasio** (`Settings.timezone`).
- **Fechas de negocio como `DATE`** y cadenas `YYYY-MM-DD` en el dominio (`src/lib/domain/dates.ts`). Un mes desde el 15-ene vence el 14-feb; desde el 31-ene vence el 28/29-feb.
- **Renovación sin perder días:** si la membresía sigue vigente, la nueva empieza al día siguiente del vencimiento; si ya venció, empieza hoy.
- **El QR contiene un token aleatorio** (`accessCode`), no datos personales; se puede regenerar.
- **Precios en centavos** y copiados en cada membresía: cambiar el precio de un plan no altera el historial.
- **Cada intento de check-in queda registrado**, incluidos los rechazados. Un mismo socio escaneado dos veces en menos de 60 s no se duplica.
- **Cobrar = renovar.** Cada renovación crea un `Payment` + `Membership` en una transacción (con bloqueo de fila contra doble toque) y pide confirmación del monto.
- **Nada se borra al corregir:** "Anular última renovación" marca membresía y pago con `voidedAt`; el vencimiento se recalcula solo con lo vigente y los reportes excluyen lo anulado (el CSV lo muestra como "Anulado").
- **Roles verificados en cada petición** contra la base de datos: desactivar a alguien corta su acceso al instante, aunque tenga la sesión abierta. Recepción no ve planes, reportes, ajustes ni ingresos.
- **Reportes en la hora local del gimnasio** (`AT TIME ZONE` en SQL); rangos de hasta 62 días se agrupan por día, mayores por mes (máx. 366 días).
- **Búsqueda sin acentos:** `Member.searchText` guarda nombre, documento y email normalizados ("lop" encuentra "López").

## Estructura

```
src/lib/domain/      lógica pura y testeada (fechas, membresía, check-in, búsqueda)
src/lib/             db, sesión/roles, settings, storage de fotos, validación (zod)
src/app/(app)/       inicio · checkin · socios · planes · reportes · ajustes  (páginas + server actions)
src/lib/reports.ts   consultas agregadas (SQL) para reportes y exportación CSV
src/components/      formularios, gráficos (HTML/CSS, sin librería), avatar, estado
src/app/api/photos/  fotos privadas (requiere sesión)
prisma/              schema, migraciones y seed
```

## Producción

- `DATABASE_URL` de un Postgres administrado (Neon / Supabase). **Quitar** `pgbouncer=true&connection_limit=1`, que solo hace falta con el servidor local de `prisma dev`.
- Las fotos se guardan en disco (`STORAGE_DIR`); en Vercel/serverless hay que cambiar `src/lib/storage.ts` a R2/S3 (misma interfaz).
- `npx prisma migrate deploy && npm run db:seed` en el primer despliegue.
- WhatsApp: `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` (pasos en [docs/whatsapp.md](docs/whatsapp.md)).
- Email: `RESEND_API_KEY`, `EMAIL_FROM` (pasos en [docs/email.md](docs/email.md)).
- `CRON_SECRET` para el cron diario de avisos (`vercel.json`), que envía ambos canales.
