# Avisos por email — guía de configuración

Los avisos por email usan los mismos momentos que WhatsApp (ver [whatsapp.md](whatsapp.md)): "por vencer"
(N días antes) y "vencida" (1–3 días después), una vez por membresía, **solo a socios que aceptaron**
(casilla "Acepta recibir avisos por email" en su ficha; exige que tenga email).

A diferencia de WhatsApp, **no hay plantillas que aprobar**: el texto vive en
`src/lib/domain/email-templates.ts` (asunto, texto plano y HTML).

## 1. Cuenta de Resend

1. Crea una cuenta en resend.com.
2. **Domains → Add domain**: agrega el dominio del gimnasio (ej. `migym.com`) y crea en tu DNS los registros que
   indica (SPF/DKIM). Sin dominio verificado, Resend solo permite enviar a tu propio correo de la cuenta
   (útil solo para pruebas).
3. **API Keys → Create API key** con permiso *Sending access*.

## 2. Variables de entorno

```bash
RESEND_API_KEY="re_..."
EMAIL_FROM="Mi Gimnasio <avisos@migym.com>"   # dominio verificado en el paso 1
EMAIL_REPLY_TO="recepcion@migym.com"          # opcional: a dónde llegan las respuestas
CRON_SECRET="..."                             # el mismo del cron de WhatsApp
```

Reinicia la app después de cambiarlas.

## 3. Probar y activar

1. **Ajustes → Avisos automáticos**: en la tarjeta "Email" debe aparecer ✓ en credenciales.
2. **Probar email**: envía un aviso de ejemplo a tu correo (revisa spam la primera vez).
3. Marca "Acepta recibir avisos por email" en los socios que lo aceptaron.
4. **Vista previa** → **activa "Enviar avisos por email cada día"** → Guardar.

El cron diario (`vercel.json`, 15:00 UTC) envía ambos canales en la misma ejecución.

## Garantías

- Mismo sistema que WhatsApp: el envío se reclama en `NotificationLog` antes de llamar a Resend (sin duplicados
  aunque corran dos ejecuciones a la vez), reintentos automáticos para errores 429/5xx/red (máx. 3) y sin
  reintentos para errores de validación (dirección inválida, dominio no verificado).
- Además se envía `Idempotency-Key: notif-<id>`; Resend descarta repeticiones con la misma clave durante 24 h,
  así que un reintento tras un corte de red no duplica el correo.
- Los nombres se escapan en el HTML (un nombre como `<b>x</b>` se muestra como texto, no como código).
