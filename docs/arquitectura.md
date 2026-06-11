# Roomly – Arquitectura del sistema

## Stack

| Componente | Tecnología | Puerto |
|------------|------------|--------|
| Backend / Dashboard | Next.js 15 + Prisma + PostgreSQL | 3000 |
| Bot WhatsApp | n8n + Gemini Flash | 5678 |
| Cola de jobs | BullMQ + Redis | 6379 |
| Base de datos | PostgreSQL (Docker) | 5433 |
| Túnel público | ngrok (free static domain) | — |

---

## Estructura de carpetas

```
roomly-n8n/
├── backend/                  # Next.js app (dashboard + API)
│   ├── app/
│   │   ├── dashboard/        # UI del dashboard (reservas, config, etc.)
│   │   └── api/v1/           # API REST consumida por n8n
│   ├── lib/
│   │   ├── queue.ts          # BullMQ worker + jobs
│   │   ├── mercadopago.ts    # Cliente singleton de MP
│   │   └── prisma.ts         # Cliente Prisma
│   ├── services/
│   │   ├── reservation.service.ts
│   │   └── payment.service.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── instrumentation.ts    # Arranca el BullMQ worker al iniciar Next.js
├── workflow.json             # Workflow de n8n (importar manualmente)
├── docker-compose.yml        # PostgreSQL + Redis + n8n
└── docs/                     # Esta carpeta
```

---

## Flujo completo de reserva con pago

```
1. Usuario escribe en WhatsApp
2. Meta → webhook → n8n (POST /roomly-wa)
3. n8n extrae mensaje → AI Agent (Gemini)
4. Agente llama consultar_habitaciones → backend devuelve disponibilidad + precios
5. Agente pregunta: ¿seña (15%) o pago total?
6. Agente llama crear_reserva con paymentType=DEPOSIT|FULL
7. Backend:
   a. Crea Reservation en estado PENDING_PAYMENT
   b. Crea preferencia en Mercado Pago
   c. Guarda Payment en DB
   d. Encola job EXPIRE_PAYMENT (24h)
   e. Devuelve { paymentUrl, payAmount, expiresAt, hotelEmail, hotelPhone }
8. Agente envía link de pago al usuario + pide que avise cuando pague
9. Usuario paga en mercadopago.com.ar
10. Usuario avisa al bot "listo, pagué"
11. Agente llama consultar_reserva → verifica status
    - CONFIRMED → confirma al usuario
    - PENDING_PAYMENT → pide que espere
```

### Confirmación automática (producción)
En producción con dominio real, MP envía webhook a `/api/v1/payments/webhook`
y la reserva pasa a CONFIRMED automáticamente sin que el usuario tenga que avisar.
Ver `docs/mercadopago.md` para detalle.

---

## Variables de entorno

### backend/.env
```
DATABASE_URL           # PostgreSQL connection string
REDIS_URL              # Redis connection string
AUTH_SECRET            # NextAuth secret
NEXTAUTH_URL           # URL pública del backend (localhost en dev)
ADMIN_EMAIL            # Email del admin del dashboard
ADMIN_PASSWORD_HASH    # Hash bcrypt de la contraseña
N8N_WEBHOOK_SECRET     # Secreto compartido entre backend y n8n
N8N_BASE_URL           # URL de n8n (http://localhost:5678 en dev)
MP_ACCESS_TOKEN        # Token de Mercado Pago (sandbox o producción)
WHATSAPP_PHONE_NUMBER_ID  # ID del número de WhatsApp Business
WHATSAPP_ACCESS_TOKEN     # Token de la API de WhatsApp (System User permanente)
GOOGLE_SERVICE_ACCOUNT_EMAIL    # Para Google Calendar (opcional)
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
GOOGLE_CALENDAR_ID
```

### .env (raíz, para Docker Compose)
```
N8N_HOST              # Dominio ngrok para n8n
WEBHOOK_URL           # URL completa de ngrok
POSTGRES_USER/PASSWORD/DB
BACKEND_URL           # http://host.docker.internal:3000
HOTEL_ID              # ID del hotel en la DB
N8N_WEBHOOK_SECRET    # Mismo valor que en backend/.env
```

---

## Jobs de BullMQ

| Job | Cuándo se encola | Qué hace |
|-----|-----------------|----------|
| `EXPIRE_PAYMENT` | Al crear preferencia MP | Cancela reserva y pago si siguen PENDING tras 24h |
| `SEND_PAYMENT_CONFIRMED` | Al confirmar pago vía webhook | (Reservado para futuro uso / producción) |
| `SCHEDULE_HOUSEKEEPING` | Al confirmar pago | Crea tarea de housekeeping para el día de checkout |
| `SEND_CONFIRMATION` | Al crear reserva sin pago | (TODO: envío de confirmación directa) |

El worker arranca automáticamente via `instrumentation.ts` cuando Next.js inicia.

---

## Dashboard

Acceso: `http://localhost:3000/dashboard`  
Login: `admin@hotel.com` / `admin123` (cambiar en producción)

Secciones:
- **Reservas** – tablero kanban, botón de checkout, badge de vencidas
- **Housekeeping** – tareas generadas automáticamente al confirmar pagos
- **Configuración** – datos del hotel, tipos de habitación, habitaciones, tarifas

---

## Workflow de n8n

Archivo: `workflow.json` en la raíz del proyecto.

Para reimportar: n8n → Workflows → ··· → Import → pegar contenido del archivo.

**Importante**: el workflow debe estar **activo** (toggle en la esquina superior derecha) para recibir mensajes de WhatsApp.

### Credenciales que usa n8n
- **WhatsApp account** – token System User permanente de Meta Business Suite
- **Google Gemini(PaLM) Api account** – API Key de Google AI Studio

### Herramientas del agente
| Tool | Endpoint | Descripción |
|------|----------|-------------|
| `consultar_habitaciones` | GET /api/v1/rooms | Disponibilidad y precios |
| `crear_reserva` | GET /api/v1/reservations/crear | Crea reserva + link de pago MP |
| `consultar_reserva` | GET /api/v1/reservations | Busca por código RML |
| `modificar_reserva` | GET /api/v1/reservations/modificar | Cambia fechas/personas |
| `cancelar_reserva` | GET /api/v1/reservations/cancelar | Cancela reserva |

---

## Pasar a producción – checklist

- [ ] Cambiar `MP_ACCESS_TOKEN` por token productivo
- [ ] Cambiar `NEXTAUTH_URL` al dominio real del backend
- [ ] Cambiar `WHATSAPP_ACCESS_TOKEN` si el token de desarrollo expira
- [ ] Cambiar `ADMIN_PASSWORD_HASH` por contraseña segura
- [ ] Cambiar `AUTH_SECRET` por valor random (openssl rand -base64 32)
- [ ] Cambiar `N8N_WEBHOOK_SECRET` por valor random
- [ ] Pasar la app de Meta a modo Live
- [ ] Crear template de WhatsApp aprobado para notificaciones proactivas (ver banner en /dashboard/configuracion)
