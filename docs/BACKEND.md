# Roomly – Backend MVP

Panel de administración y API REST para el sistema de reservas Roomly.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| ORM | Prisma 5 |
| Base de datos | PostgreSQL 16 |
| Cache / Queues | Redis 7 + BullMQ |
| Auth | NextAuth v5 (Credentials) |
| Validación | Zod |
| UI | shadcn/ui + Tailwind CSS |
| Runtime | Node.js 20 |

---

## Estructura del proyecto

```
backend/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts   # Handlers NextAuth
│   │   └── v1/
│   │       ├── reservations/
│   │       │   ├── route.ts              # GET list / POST create
│   │       │   └── [id]/route.ts         # GET / PATCH / DELETE by id or RML code
│   │       ├── rooms/route.ts            # GET list / POST create
│   │       ├── guests/route.ts           # GET list / POST upsert
│   │       └── hotels/route.ts           # GET list / POST create
│   ├── dashboard/
│   │   ├── layout.tsx                    # Navbar + auth guard (server)
│   │   ├── page.tsx                      # Lista de reservas + stats
│   │   └── rooms/page.tsx               # Grilla de habitaciones
│   └── login/page.tsx                   # Formulario de login
├── components/dashboard/
│   ├── ReservationTable.tsx              # Tabla de reservas (client)
│   └── RoomGrid.tsx                     # Grilla por piso (client)
├── lib/
│   ├── prisma.ts                         # Prisma singleton
│   ├── redis.ts                          # Redis/ioredis singleton
│   ├── queue.ts                          # BullMQ queues + worker
│   └── validations.ts                   # Zod schemas
├── services/
│   ├── availability.service.ts          # Lógica de disponibilidad
│   └── reservation.service.ts           # CRUD reservas + audit log
├── prisma/
│   ├── schema.prisma                     # Modelo de datos
│   ├── seed.ts                           # Datos iniciales
│   └── migrations/                       # Historial SQL
├── auth.ts                               # Configuración NextAuth
├── middleware.ts                         # Protección de rutas
├── Dockerfile                            # Multi-stage build
├── entrypoint.sh                         # migrate deploy + start
└── .env.example                          # Variables de entorno
```

---

## Modelo de datos

### Entidades principales

```
Hotel ──< RoomType ──< Room
      ──< RatePlan (por RoomType)
      ──< Guest ──< Reservation ──< HousekeepingTask
                                ──< AuditLog
```

| Modelo | Descripción |
|---|---|
| `Hotel` | Unidad de negocio. MVP: 1 hotel. |
| `RoomType` | Tipo de habitación (Standard, Suite, etc.) con amenities. |
| `Room` | Habitación física (`number`, `floor`, `status`). |
| `RatePlan` | Precio por noche para un tipo, en un rango de fechas. |
| `Guest` | Huésped identificado por `(hotelId, phone)` único. |
| `Reservation` | Reserva con código `RML-XXXX` único. Incluye `checkIn`/`checkOut` como `@db.Date`. |
| `HousekeepingTask` | Tarea de limpieza (se crea automáticamente al hacer una reserva). |
| `ConversationSession` | Estado parcial de una conversación WhatsApp (contexto JSON). |
| `AuditLog` | Historial de cambios por reserva (before/after JSON). |

### Prevención de double-booking

El esquema incluye una restricción PostgreSQL GIST que **impide físicamente** solapar reservas para la misma habitación:

```sql
-- Se agrega via migración manual (ver prisma/migrations/)
ALTER TABLE "Reservation"
ADD CONSTRAINT "no_double_booking"
EXCLUDE USING GIST (
  "roomId" WITH =,
  daterange("checkIn", "checkOut", '[)') WITH &&
) WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));
```

Esto requiere la extensión `btree_gist` de PostgreSQL.

La capa de servicio también hace una verificación previa en memoria (`availability.service.ts`) para dar un mensaje de error claro antes de que la DB rechace la operación.

---

## API REST

Todas las rutas bajo `/api/v1/` requieren autenticación:
- **Sesión activa** (cookie de NextAuth) — para el dashboard
- **Header `X-N8N-Secret: <valor>`** — para llamadas desde n8n

### Reservas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/reservations?hotelId=&status=&from=&to=&page=&pageSize=` | Lista paginada |
| `POST` | `/api/v1/reservations` | Crear reserva |
| `GET` | `/api/v1/reservations/:id` | Obtener por ID o código `RML-XXXX` |
| `PATCH` | `/api/v1/reservations/:id` | Modificar fechas, estado, habitación |
| `DELETE` | `/api/v1/reservations/:id` | Cancelar (soft delete) |

**Body para crear reserva (POST):**
```json
{
  "hotelId": "cuid...",
  "roomId": "cuid...",
  "guest": {
    "name": "Juan Pérez",
    "phone": "5492616649039"
  },
  "checkIn": "2026-06-01",
  "checkOut": "2026-06-05",
  "numGuests": 2,
  "channel": "WHATSAPP",
  "code": "RML-1234"
}
```

> El campo `code` es opcional. Si viene del flujo de n8n (donde ya se generó), se preserva. Si no, el backend genera uno único.

### Habitaciones

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/rooms?hotelId=` | Todas las habitaciones |
| `GET` | `/api/v1/rooms?hotelId=&checkIn=&checkOut=` | Solo habitaciones disponibles |
| `POST` | `/api/v1/rooms` | Crear habitación |

### Huéspedes

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/guests?hotelId=&phone=&name=` | Buscar huéspedes |
| `POST` | `/api/v1/guests` | Crear o actualizar huésped (upsert por teléfono) |

### Hoteles

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/v1/hotels` | Listar hoteles |
| `POST` | `/api/v1/hotels` | Crear hotel |

---

## Autenticación

### Panel de administración

Se usa **NextAuth v5** con proveedor `Credentials`. No hay tabla de usuarios — las credenciales del admin viven en variables de entorno:

```env
ADMIN_EMAIL=admin@hotel.com
ADMIN_PASSWORD_HASH=$2b$10$...  # bcrypt hash
```

Para generar el hash:
```bash
node -e "const b=require('bcryptjs'); console.log(b.hashSync('tupassword', 10))"
```

### Integración con n8n

Las llamadas desde n8n usan un secreto compartido en el header HTTP:

```
X-N8N-Secret: <N8N_WEBHOOK_SECRET>
```

Configurar en n8n: en el nodo HTTP Request que llama al backend, agregar el header `X-N8N-Secret`.

---

## Colas asíncronas (BullMQ)

Al crear una reserva, se encolan automáticamente dos jobs:

| Job | Descripción |
|---|---|
| `SEND_CONFIRMATION` | Enviar confirmación por WhatsApp (TODO: conectar a WABA API) |
| `SCHEDULE_HOUSEKEEPING` | Crear tarea de limpieza para el día del check-out |

Los workers se definen en `lib/queue.ts`. En producción, corren en un proceso separado.

---

## Dashboard

Accesible en `http://localhost:3000/dashboard` (requiere login).

### Página de reservas (`/dashboard`)
- KPIs: check-ins de hoy, huéspedes activos, reservas confirmadas
- Tabla completa con código RML, huésped, habitación, fechas, estado, canal

### Página de habitaciones (`/dashboard/rooms`)
- Grilla visual por piso
- Colores: verde (libre), rojo (ocupada), amarillo (mantenimiento)
- Muestra el nombre del huésped en habitaciones ocupadas
- Filtro: próximos 7 días

---

## Setup local

### 1. Requisitos
- Node.js 20+
- Docker Desktop (para postgres y redis)

### 2. Levantar servicios de infraestructura
```bash
# Desde la raíz del repo
docker compose up postgres redis -d
```

### 3. Configurar variables de entorno
```bash
cd backend
cp .env.example .env
# Editar .env con tus valores
```

### 4. Instalar dependencias y migrar
```bash
npm install
npm run db:migrate   # crea las tablas + aplica el EXCLUDE constraint
npm run db:seed      # carga hotel, tipos y habitaciones de ejemplo
```

### 5. Iniciar el servidor de desarrollo
```bash
npm run dev
# → http://localhost:3000
```

---

## Migración con EXCLUDE constraint

La migración inicial incluye un paso manual SQL para agregar la restricción de double-booking. Luego de correr `npx prisma migrate dev --name init`, editar el archivo SQL generado en `prisma/migrations/*/migration.sql` y agregar al final:

```sql
-- Habilitar extensión necesaria para GIST en columnas no geométricas
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Restricción de exclusión para prevenir solapamiento de reservas
ALTER TABLE "Reservation"
ADD CONSTRAINT "no_double_booking"
EXCLUDE USING GIST (
  "roomId" WITH =,
  daterange("checkIn"::date, "checkOut"::date, '[)') WITH &&
) WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));
```

---

## Deploy con Docker

### 1. Descomentar el servicio `nextjs` en `docker-compose.yml`

### 2. Completar variables de entorno en `.env`

### 3. Levantar todo
```bash
docker compose up -d
```

El contenedor de Next.js ejecuta `entrypoint.sh` que:
1. Corre `prisma migrate deploy` (aplica migraciones pendientes)
2. Inicia el servidor Next.js en modo producción

---

## Integración n8n ↔ Backend

Una vez que el flujo de WhatsApp completa la recopilación de datos, n8n puede llamar al backend:

### Opción A: HTTP Request node en n8n
```
POST https://tu-backend.com/api/v1/reservations
Headers:
  X-N8N-Secret: <N8N_WEBHOOK_SECRET>
  Content-Type: application/json
Body: { hotelId, roomId, guest, checkIn, checkOut, numGuests, channel: "WHATSAPP", code: "{{ $json.codigoRML }}" }
```

### Opción B: Mantener Google Calendar y sincronizar luego
El workflow actual de n8n puede seguir usando Google Calendar. Un proceso de sincronización periódica puede importar los eventos al backend.

---

## Variables de entorno

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | URL de PostgreSQL |
| `REDIS_URL` | URL de Redis |
| `AUTH_SECRET` | Secreto para firmar JWT (generar con `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | URL pública del backend |
| `ADMIN_EMAIL` | Email del administrador |
| `ADMIN_PASSWORD_HASH` | Hash bcrypt de la contraseña |
| `N8N_WEBHOOK_SECRET` | Secreto compartido para requests desde n8n |
| `POSTGRES_USER` | Usuario de PostgreSQL (Docker) |
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL (Docker) |
| `POSTGRES_DB` | Nombre de la base de datos (Docker) |
