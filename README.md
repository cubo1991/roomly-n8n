# Roomly – Asistente de reservas por WhatsApp

Bot de WhatsApp que gestiona reservas de hotel usando n8n + Google Gemini + un backend propio en Next.js.

## Stack

| Componente | Tecnología | Rol |
|------------|-----------|-----|
| **Backend** | Next.js 14 + Prisma | API REST, lógica de negocio, **fuente de verdad** |
| **Base de datos** | PostgreSQL | Persistencia de reservas, huéspedes, habitaciones |
| **Cache / Colas** | Redis + BullMQ | Jobs async (confirmaciones, housekeeping) |
| **Automatización** | n8n (Docker) | Orquestación del flujo WhatsApp → IA → respuesta |
| **IA** | Google Gemini Flash Lite | Procesamiento del lenguaje, decisión de acciones |
| **Canal** | WhatsApp Business API | Comunicación con el huésped |
| **Calendario** | Google Calendar | Espejo visual de reservas (no es la fuente de verdad) |
| **Túnel** | ngrok | Exposición pública del webhook en desarrollo |

## Arquitectura

```
WhatsApp
   │  (POST)
   ▼
n8n webhook ──► Gemini AI Agent
                    │
                    ├── consultar_habitaciones ──► Backend API
                    ├── crear_reserva          ──► Backend API ──► PostgreSQL
                    ├── consultar_reserva      ──► Backend API        │
                    ├── modificar_reserva      ──► Backend API        └──► Google Calendar
                    └── cancelar_reserva       ──► Backend API             (espejo)
```

El backend es la fuente de verdad. Google Calendar se actualiza automáticamente como vista secundaria pero no se consulta para nada operativo.

## Funcionalidades

- **Nueva reserva** – el agente consulta disponibilidad, elige habitación y confirma con código `RML-XXXX`
- **Consulta** – por código RML devuelve todos los detalles
- **Modificación** – cambia fechas o cantidad de personas
- **Cancelación** – requiere confirmación explícita del huésped
- **Memoria conversacional** – cada usuario tiene su propio contexto (últimos 10 mensajes)
- **Google Calendar** – cada reserva crea un evento; se actualiza/elimina al modificar/cancelar

## Setup

### Requisitos

- Docker Desktop
- Node.js 18+
- Cuenta de WhatsApp Business API (Meta Developer)
- API Key de Google Gemini (Google AI Studio)
- Service account de Google con acceso a Google Calendar
- ngrok

### 1. Clonar y configurar variables de entorno

```bash
git clone https://github.com/cubo1991/roomly-n8n.git
cd roomly-n8n
```

**Variables de n8n / Docker** (`/.env`):
```env
N8N_HOST=<tu-subdominio>.ngrok-free.app
WEBHOOK_URL=https://<tu-subdominio>.ngrok-free.app
WHATSAPP_RECIPIENT=<número-con-código-de-país>
POSTGRES_USER=roomly
POSTGRES_PASSWORD=roomly_password
POSTGRES_DB=roomly
BACKEND_URL=http://host.docker.internal:3000
HOTEL_ID=<id-del-hotel-en-la-db>
N8N_WEBHOOK_SECRET=<secret-compartido-con-el-backend>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<email-de-la-service-account>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_CALENDAR_ID=<email-o-id-del-calendario>
```

**Variables del backend** (`/backend/.env`):
```env
DATABASE_URL="postgresql://roomly:roomly_password@localhost:5433/roomly"
REDIS_URL="redis://localhost:6379"
AUTH_SECRET="<secreto-aleatorio>"
NEXTAUTH_URL="http://localhost:3000"
ADMIN_EMAIL="admin@hotel.com"
ADMIN_PASSWORD_HASH="<hash-bcrypt>"
N8N_WEBHOOK_SECRET=<mismo-secret-que-en-raiz>
GOOGLE_SERVICE_ACCOUNT_EMAIL=<igual-que-arriba>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_CALENDAR_ID=<igual-que-arriba>
```

### 2. Levantar Docker (n8n + PostgreSQL + Redis)

```bash
docker compose -f docker-compose.yml --env-file .env up -d
```

O usar el acceso directo: **`Iniciar Roomly.bat`** (en el Escritorio).

### 3. Levantar el backend

```bash
cd backend
npm install
npx prisma migrate deploy
npx tsx prisma/seed.ts   # crea hotel, habitaciones y rate plans
npm run dev              # http://localhost:3000
```

> Después del seed, copiá el `HOTEL_ID` que imprime y actualizalo en `/.env`. Luego recreá el contenedor n8n:
> ```bash
> docker compose --env-file .env up -d --force-recreate n8n
> ```

### 4. Configurar ngrok

```bash
ngrok http 5678
```

Copiá la URL generada en las variables `N8N_HOST` y `WEBHOOK_URL` del `/.env` y recreá n8n.

### 5. Importar y configurar el workflow en n8n

1. Abrí `http://localhost:5678`
2. **Workflows → Import from file** → seleccioná `workflow.json`
3. Asigná credenciales en los nodos que las requieren:
   - **WhatsApp account** – token de acceso permanente de Meta
   - **Google Gemini(PaLM) Api account** – API Key de Google AI Studio
4. En el nodo **Gemini Flash**, verificá que el modelo sea `models/gemini-3.1-flash-lite`
5. Activá el workflow (toggle **Published**)

### 6. Verificar webhook en Meta

En Meta Developer Console → WhatsApp → Configuration:
- **Callback URL:** `https://<ngrok-url>/webhook/roomly-wa`
- **Verify Token:** `roomly2026`

Verificar y guardar. Luego en **Webhook fields** → **messages** → **Subscribe**.

### 7. Verificar integración con Google Calendar (opcional)

```bash
cd backend
npx tsx scripts/test-calendar.ts
```

## Estructura del proyecto

```
roomly-n8n/
├── backend/                        # API REST (Next.js 14 + Prisma)
│   ├── app/api/v1/                 # Endpoints REST
│   │   ├── rooms/                  # Consulta de disponibilidad
│   │   └── reservations/           # CRUD de reservas
│   ├── lib/
│   │   ├── calendar.ts             # Integración Google Calendar
│   │   ├── prisma.ts               # Cliente Prisma
│   │   └── queue.ts                # BullMQ
│   ├── services/
│   │   └── reservation.service.ts  # Lógica de negocio
│   ├── prisma/
│   │   ├── schema.prisma           # Modelo de datos
│   │   └── seed.ts                 # Datos iniciales
│   └── scripts/
│       └── test-calendar.ts        # Script de diagnóstico Calendar
├── workflow.json                   # Workflow n8n v14
├── docker-compose.yml              # Stack Docker
├── .env                            # Variables n8n + Docker (NO subir a git)
├── WORKFLOW_NODOS.md               # Documentación de cada nodo del workflow
├── PROBLEMAS_Y_SOLUCIONES.md       # Registro de bugs y soluciones
└── Iniciar Roomly.bat              # Script de inicio rápido (Windows)
```

## API Reference

Todos los endpoints requieren el parámetro `_s=<N8N_WEBHOOK_SECRET>`.

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/v1/rooms` | Habitaciones disponibles (`hotelId`, `checkIn`, `checkOut`) |
| `GET` | `/api/v1/reservations/crear` | Crear reserva |
| `GET` | `/api/v1/reservations` | Consultar reserva por código (`code=RML-XXXX`) |
| `GET` | `/api/v1/reservations/modificar` | Modificar reserva (`id`, campos a cambiar) |
| `GET` | `/api/v1/reservations/cancelar` | Cancelar reserva (`id`) |

## Notas importantes

- El modelo Gemini correcto es `models/gemini-3.1-flash-lite`. Los modelos `gemini-2.5-flash` (429) y `gemini-1.5-flash` (404) no funcionan en free tier.
- El `--env-file` es obligatorio en el comando `docker compose` o el contenedor arranca sin variables.
- Google Calendar es un espejo: si se cae o falla, las reservas siguen funcionando normalmente.
- Ver `PROBLEMAS_Y_SOLUCIONES.md` para bugs conocidos y sus soluciones.
