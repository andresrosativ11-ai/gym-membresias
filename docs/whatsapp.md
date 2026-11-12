# Avisos por WhatsApp — guía de configuración

La app envía dos avisos automáticos por WhatsApp Cloud API (Meta):

| Aviso | Cuándo | Plantilla (por defecto) |
|---|---|---|
| Por vencer | Entre N días antes y el día del vencimiento (N = "Aviso por vencer" en Ajustes) | `membresia_por_vencer` |
| Vencida | Entre 1 y 3 días después de vencer, si no renovó | `membresia_vencida` |

Cada socio recibe **como máximo un aviso de cada tipo por membresía**, y solo si en su ficha está marcado
**"Acepta recibir avisos por WhatsApp"**.

## 1. Cuenta de Meta (una sola vez)

1. Crea (o usa) un **Meta Business Portfolio** en business.facebook.com.
2. En developers.facebook.com crea una **App** de tipo *Business* y agrégale el producto **WhatsApp**.
3. Registra el **número del gimnasio** (no puede estar usándose en la app normal de WhatsApp / WhatsApp Business
   del teléfono; Meta pide verificarlo por SMS o llamada). Mientras tanto puedes usar el número de prueba que da Meta,
   que solo envía a hasta 5 números que tú agregues.
4. Copia el **Phone number ID** (WhatsApp → API Setup). Es un número largo, distinto del teléfono.
5. Crea un **token permanente**: Business Settings → Users → **System users** → agrega uno con rol Admin →
   *Generate token* para tu app con el permiso `whatsapp_business_messaging` (y `whatsapp_business_management`).
   El token temporal de "API Setup" caduca en 24 h; no lo uses en producción.
6. Agrega un **método de pago** a la cuenta de WhatsApp: los mensajes de plantilla tienen costo por mensaje según
   el país (consulta la tabla de precios vigente de Meta).

## 2. Plantillas (deben aprobarse antes de enviar)

En WhatsApp Manager → *Message templates* → *Create template*:

- **Categoría:** Utility (recordatorio de una cuenta/servicio existente).
- **Idioma:** Spanish → código `es` (el predeterminado). Si eliges otra variante (ej. `es_MX`, `es_ES`), ponla en `WHATSAPP_TEMPLATE_LANG`.
- **Variables:** exactamente 3, en este orden: `{{1}}` nombre, `{{2}}` gimnasio, `{{3}}` fecha (dd/mm/aaaa).

**`membresia_por_vencer`**

> Hola {{1}}, tu membresía en {{2}} vence el {{3}}. Renuévala en recepción para no perder tu acceso.

**`membresia_vencida`**

> Hola {{1}}, tu membresía en {{2}} venció el {{3}}. ¡Te esperamos en recepción para renovarla!

Meta pide valores de ejemplo para cada variable (ej. `Ana`, `Mi Gimnasio`, `13/11/2026`). La aprobación suele
tardar de minutos a unas horas. Puedes usar otros nombres con `WHATSAPP_TEMPLATE_EXPIRING` /
`WHATSAPP_TEMPLATE_EXPIRED`, pero el orden de las 3 variables debe mantenerse.

## 3. Variables de entorno

```bash
WHATSAPP_TOKEN="EAAG..."            # token permanente del system user
WHATSAPP_PHONE_NUMBER_ID="1234..."  # Phone number ID (no el teléfono)
CRON_SECRET="..."                   # openssl rand -base64 32
# opcionales
WHATSAPP_API_VERSION="v23.0"        # versión de Graph API; actualízala según el changelog de Meta
WHATSAPP_TEMPLATE_LANG="es"
```

Reinicia la app después de cambiarlas.

## 4. Probar y activar

1. **Ajustes → Avisos por WhatsApp**: el estado debe mostrar ✓ en "Credenciales del servidor".
2. **Mensaje de prueba**: envía `hello_world` a tu propio número. Si usas el número de prueba de Meta, ese
   teléfono debe estar en la lista de destinatarios permitidos.
3. Marca la casilla de consentimiento en los socios que aceptaron (Socios → Editar datos).
4. **Vista previa**: muestra a quién se enviaría hoy, sin enviar nada.
5. Activa **"Enviar avisos automáticamente cada día"** y guarda.
6. (Opcional) **Enviar pendientes ahora** para no esperar al cron.

## 5. Envío diario (cron)

`vercel.json` programa `GET /api/cron/notifications` todos los días a las **13:00 UTC** (9:00 en Caracas).
Cambia `schedule` si tu zona horaria es otra. Vercel envía `Authorization: Bearer $CRON_SECRET` automáticamente.

Fuera de Vercel, cualquier cron sirve:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO/api/cron/notifications
```

Responde solo totales: `{"ok":true,"sent":3,"failed":0}`.

## Garantías y errores

- **Sin duplicados:** el envío se "reclama" en `NotificationLog` antes de llamar a Meta (restricción única por
  membresía + tipo), así que dos ejecuciones simultáneas no envían dos veces.
- **Reintentos:** errores transitorios (sin red, 429, 5xx) se reintentan en las siguientes ejecuciones, hasta 3
  intentos. Errores permanentes (plantilla inexistente, número sin WhatsApp, permisos) no se reintentan.
- **Historial:** Ajustes → Avisos por WhatsApp muestra los últimos envíos con su error; la ficha de cada socio
  muestra los suyos.
- Errores frecuentes de Meta: `132001` plantilla no existe / idioma distinto; `131030` número no permitido
  (modo prueba); `190` token inválido o vencido; `131026` el número no tiene WhatsApp.
