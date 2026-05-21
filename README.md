# Roomly – Asistente de reservas por WhatsApp

Bot de WhatsApp que gestiona reservas de hotel usando n8n + Google Gemini + Google Calendar.

## Stack
- **n8n** – motor de automatización (Docker)
- **Google Gemini Flash** – modelo de IA (API gratuita)
- **Google Calendar** – base de datos de reservas
- **WhatsApp Business API** – canal de comunicación
- **ngrok** – exposición pública del webhook

## Funcionalidades
- Crear reservas con código RML único
- Consultar reservas por código o nombre
- Modificar fechas y cantidad de personas
- Cancelar reservas con confirmación explícita

## Setup

### 1. Requisitos
- Docker Desktop instalado
- Cuenta de WhatsApp Business API
- Cuenta de Google Cloud con Calendar API habilitada
- API Key de Google Gemini
- ngrok instalado

### 2. Configurar variables de entorno
```bash
cp .env.example .env
# Editá .env con tus valores reales
```

### 3. Levantar el stack
```bash
docker compose up -d
```

### 4. Importar el workflow en n8n
1. Abrí `http://localhost:5678`
2. Workflows → Import from file → seleccioná `workflow.json`
3. Configurá las credenciales en cada nodo:
   - **WhatsApp account** – token de WhatsApp Business API
   - **Google Calendar account** – OAuth2 de Google Calendar
   - **Google Gemini account** – API Key de Gemini

### 5. Activar y probar
Activá el workflow y mandá un mensaje de WhatsApp al número configurado.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `N8N_HOST` | Dominio de ngrok (sin https://) |
| `WEBHOOK_URL` | URL completa de ngrok |
| `WHATSAPP_RECIPIENT` | Número destino con código de país |
| `GOOGLE_CALENDAR_ID` | Email del calendario de Google |

## Estructura del proyecto

```
roomly-n8n/
├── workflow.json       # Workflow de n8n
├── docker-compose.yml  # Stack Docker
├── .env.example        # Template de variables
├── .env                # Variables reales (NO subir a git)
└── .gitignore
```
