# Roomly – Problemas y Soluciones

Registro de bugs encontrados durante el desarrollo y cómo se resolvieron.

## Notas de configuración

| Componente | Valor correcto | Notas |
|------------|---------------|-------|
| Modelo Gemini (n8n) | `models/gemini-3.1-flash-lite` | Los modelos `gemini-2.5-flash` y `gemini-1.5-flash` dan problemas: el primero tiene rate limit muy bajo en free tier (429), el segundo da 404. Usar siempre `models/gemini-3.1-flash-lite`. |

---

## [001] 401 Unauthorized – n8n no se conecta con el backend

**Fecha:** 2026-05-27  
**Síntoma:** El agente de IA respondía siempre con un error como "Uh, disculpá, hubo un problema al buscar habitaciones." Al revisar los logs de n8n, todos los tools HTTP devolvían `401 Unauthorized`.

### Causas (eran tres, todas juntas)

#### 1. `--env-file` faltante en Docker Compose
El archivo `Iniciar Roomly.bat` lanzaba Docker así:
```bat
docker compose -f "...\docker-compose.yml" up -d
```
Sin `--env-file` explícito, Docker Compose **no encontraba el `.env`** de la raíz del proyecto y el contenedor de n8n arrancaba con todas las variables de entorno vacías (`N8N_WEBHOOK_SECRET`, `HOTEL_ID`, `BACKEND_URL`, etc. = `""`).

**Verificación del problema:**
```powershell
docker exec n8nNgrok env | findstr N8N_WEBHOOK_SECRET
# → (sin output = variable vacía)
```

#### 2. Trailing slash en `N8N_WEBHOOK_SECRET`
En el `.env` raíz el valor era:
```
N8N_WEBHOOK_SECRET=roomly-n8n-secret-dev/   ← slash de más
```
Mientras que en `backend/.env`:
```
N8N_WEBHOOK_SECRET="roomly-n8n-secret-dev"  ← sin slash
```
El middleware comparaba `"roomly-n8n-secret-dev/"` contra `"roomly-n8n-secret-dev"` → siempre `false` → 401.

#### 3. Sin habitaciones en la base de datos
El `HOTEL_ID` en `.env` apuntaba a un hotel que existía en la DB pero sin habitaciones (`[]`). El agente consultaba disponibilidad, recibía un array vacío y no podía continuar el flujo.

### Solución

**Paso 1 – Quitar el trailing slash del `.env` raíz:**
```
# Antes
N8N_WEBHOOK_SECRET=roomly-n8n-secret-dev/

# Después
N8N_WEBHOOK_SECRET=roomly-n8n-secret-dev
```

**Paso 2 – Agregar `--env-file` al `.bat` y al comando de recreación:**
```bat
docker compose -f "C:\Users\David\roomly-n8n\docker-compose.yml" --env-file "C:\Users\David\roomly-n8n\.env" up -d
```

**Paso 3 – Recrear el contenedor n8n para que tome las variables:**
```powershell
docker compose -f "C:\Users\David\roomly-n8n\docker-compose.yml" --env-file "C:\Users\David\roomly-n8n\.env" up -d --force-recreate n8n
```

**Paso 4 – Correr el seed para crear habitaciones:**
```powershell
cd C:\Users\David\roomly-n8n\backend
npx tsx prisma/seed.ts
# → crea hotel, 2 tipos de habitación, 7 habitaciones, rate plans
```

**Paso 5 – Actualizar `HOTEL_ID` con el ID real que devolvió el seed:**
```
# .env raíz
HOTEL_ID=cmpnag0cv00001g3ccv957sed
```
Y recrear n8n nuevamente para que tome el nuevo `HOTEL_ID`.

### Verificación final
```powershell
# Variables dentro del contenedor
docker exec n8nNgrok env | grep -E "HOTEL_ID|N8N_WEBHOOK_SECRET"
# HOTEL_ID=cmpnag0cv00001g3ccv957sed
# N8N_WEBHOOK_SECRET=roomly-n8n-secret-dev

# Endpoint de habitaciones (desde fuera del contenedor)
curl "http://localhost:3000/api/v1/rooms?hotelId=cmpnag0cv00001g3ccv957sed&_s=roomly-n8n-secret-dev&checkIn=2026-06-10&checkOut=2026-06-12"
# → devuelve array con 7 habitaciones ✅

# Crear reserva de prueba
curl "http://localhost:3000/api/v1/reservations/crear?hotelId=...&_s=roomly-n8n-secret-dev&roomId=...&guestName=Test&..."
# → {"code":"RML-XXXX","status":"CONFIRMED",...} ✅
```

### Lección aprendida
> Siempre pasar `--env-file` explícito en Docker Compose cuando el `.env` no está en el directorio de trabajo desde donde se ejecuta el comando. No asumir que Docker lo encuentra solo.

---

## [002] WhatsApp webhook no recibe mensajes – hub.challenge falla

**Fecha:** 2026-05-27  
**Síntoma:** Los mensajes de WhatsApp no llegaban al bot. Meta Developer Console mostraba el error `(#2201) response does not match challenge, expected value="XXXXXXX"` al intentar verificar el webhook.

### Causas (encadenadas)

#### 1. Webhook no registrado en el runtime de n8n tras recrear el contenedor
Después de un `--force-recreate` del contenedor, n8n mostraba el workflow como "Published" en la UI pero internamente el webhook no estaba registrado. Los logs mostraban:
```
Received request for unknown webhook: "a3989a6b-2aa1-441d-8ef6-c91e5954738f/webhook" is not registered.
```
Hacer toggle Unpublish → Publish no alcanzaba porque la activación fallaba antes de registrar el webhook local.

#### 2. Suscripción de Meta en conflicto
Cuando n8n intentaba activar el WhatsApp Trigger, llamaba a la Meta Graph API para crear la suscripción. Meta respondía:
```
The WhatsApp App ID 1275991001111185 already has a webhook subscription.
```
Esto hacía que la activación fallara silenciosamente y el webhook nunca se registraba.

#### 3. El nodo WhatsApp Trigger no responde al hub.challenge
El nodo `whatsAppTrigger` de n8n no maneja correctamente la verificación GET de Meta. En lugar de devolver el valor de `hub.challenge`, respondía:
```json
{"message": "Webhook call received"}
```
Meta requiere que la respuesta sea **exactamente** el valor de `hub.challenge` como texto plano.

#### 4. n8n no enruta GET a webhooks con método "ALL"
Al reemplazar el WhatsApp Trigger con un Webhook genérico configurado como `httpMethod: "ALL"`, n8n tampoco respondía a GET:
```
This webhook is not registered for GET requests. Did you mean to make a ALL request?
```

### Solución definitiva

**Reemplazar el WhatsApp Trigger con dos nodos Webhook separados** en el mismo path (`roomly-wa`), uno para GET y otro para POST.

**Workflow v14 – estructura:**
```
GET  /webhook/roomly-wa  →  Responder challenge (devuelve hub.challenge como texto)
POST /webhook/roomly-wa  →  Ack 200  →  Extraer datos  →  AI Agent  →  Enviar WhatsApp  →  Log
```

**Nodo GET (verificación):**
```json
{
  "httpMethod": "GET",
  "path": "roomly-wa",
  "responseMode": "responseNode"
}
```
Conectado a un nodo "Respond to Webhook" que devuelve:
```
={{ ($json.query?.hub?.challenge) ?? ($json.query?.['hub.challenge']) ?? '' }}
```

**Nodo POST (mensajes reales):**
```json
{
  "httpMethod": "POST",
  "path": "roomly-wa",
  "responseMode": "responseNode"
}
```
Conectado a un nodo "Respond to Webhook" que devuelve `OK` inmediatamente, y luego continúa el flujo de procesamiento.

**Extracción del mensaje** actualizada para el formato nativo de Meta (el Webhook genérico no desenvuelve el payload como lo hacía el WhatsApp Trigger):
```javascript
const raw = $input.first().json;
const item = (raw.body && raw.body.entry) ? raw.body : raw;
const value = item.entry?.[0]?.changes?.[0]?.value;
// ... resto del parsing
```

**Pasos para aplicar:**
1. Borrar el workflow viejo en n8n
2. Importar `workflow.json` (v14)
3. Reasignar credenciales (WhatsApp + Gemini) en los nodos que las necesitan
4. Activar (Published)
5. En Meta Developer Console → WhatsApp → Configuration → Verificar y guardar:
   - **Callback URL:** `https://<ngrok-url>/webhook/roomly-wa`
   - **Verify Token:** `roomly2026`
6. **⚠️ Paso que se olvida fácil:** Después de verificar, en la misma sección buscar **"Webhook fields"** → buscar **"messages"** → click en **"Subscribe"**. Sin este paso Meta NO envía los mensajes aunque el webhook esté verificado.

**Para eliminar la suscripción vieja de Meta** (si aparece el error "already has a webhook subscription"):
```
Meta Graph API Explorer → App Token → DELETE
/1275991001111185/subscriptions?object=whatsapp_business_account
→ {"success": true}
```

### Verificación
```bash
curl "https://<ngrok-url>/webhook/roomly-wa?hub.mode=subscribe&hub.verify_token=roomly2026&hub.challenge=TEST123"
# → TEST123   (HTTP 200) ✅
```

### Lección aprendida
> El nodo `whatsAppTrigger` de n8n no implementa correctamente la respuesta al `hub.challenge` de Meta. Para proyectos propios, usar dos nodos `webhook` separados (GET + POST) en el mismo path es más confiable y transparente. El GET maneja la verificación y el POST los mensajes reales.

---

## [003] Nombre del huésped se pisa entre reservas del mismo teléfono

**Fecha:** 2026-05-27  
**Síntoma:** Al crear una nueva reserva con un teléfono que ya tenía reservas anteriores, el nombre que se enviaba en la nueva reserva sobreescribía el nombre en **todas** las reservas previas del mismo huésped.

### Causa

En `reservation.service.ts`, el upsert del huésped incluía `name` en el bloque `update`:

```typescript
const guestRecord = await prisma.guest.upsert({
  where: { hotelId_phone: { hotelId, phone: guest.phone } },
  update: { name: guest.name, email: ..., dni: ... }, // ← pisaba el nombre
  create: { ... },
});
```

El modelo de datos tiene **un registro `Guest` por teléfono**, y todas las reservas de ese huésped apuntan al mismo `guestId`. Al actualizar el nombre del `Guest`, el cambio se reflejaba en todo el historial.

### Solución

Quitar `name` del bloque `update`. El nombre se registra solo al **crear** el huésped (primera reserva). Las siguientes reservas con el mismo teléfono reutilizan el nombre ya guardado.

```typescript
update: { email: guest.email ?? undefined, dni: guest.dni ?? undefined },
```

`email` y `dni` sí se permiten actualizar porque son datos corregibles que no afectan el historial visible.

### Archivo modificado
`backend/services/reservation.service.ts`

---

*Más problemas se irán agregando a este archivo.*
