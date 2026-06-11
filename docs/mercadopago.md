# Mercado Pago – Integración Checkout Pro

## Credenciales

### Sandbox (desarrollo)
Ubicadas en `backend/.env`:

```
MP_ACCESS_TOKEN="APP_USR-6393464285674842-052011-..."
```

- Obtenidas desde [developers.mercadopago.com](https://www.mercadopago.com.ar/developers/panel) → Tu app → **Credenciales de prueba**
- La app se llama **Tp9**
- Estas credenciales son compartidas con el TP9 de la materia — reemplazarlas en producción

### Producción
Reemplazar `MP_ACCESS_TOKEN` en `backend/.env` con el Access Token productivo de la misma app (pestaña "Productivas").

---

## Flujo de pago

```
Usuario en WhatsApp
       │
       ▼
Bot pregunta: ¿seña (15%) o total?
       │
       ▼
Backend crea preferencia MP → devuelve paymentUrl
       │
       ▼
Bot envía link al usuario + avisa que tiene 24h
       │
       ▼
Usuario paga en mercadopago.com.ar
       │
       ▼
Usuario avisa al bot "listo, pagué"
       │
       ▼
Bot llama consultar_reserva → verifica status
  ├─ CONFIRMED → "¡Reserva confirmada! 🏨"
  └─ PENDING_PAYMENT → "Todavía no veo el pago, avisame en un ratito"
```

### Estados de reserva relacionados
| Estado | Significado |
|--------|-------------|
| `PENDING_PAYMENT` | Reserva creada, esperando pago (bloquea disponibilidad por 24h) |
| `CONFIRMED` | Pago acreditado por MP |
| `CANCELLED` | Auto-cancelada por falta de pago a las 24h |

---

## Webhook de MP (notificación automática)

MP envía un POST a `notification_url` cuando cambia el estado de un pago.

### URL configurada
```
{NEXTAUTH_URL}/api/v1/payments/webhook
```

En desarrollo (`NEXTAUTH_URL=http://localhost:3000`), MP **no puede alcanzar localhost**. El estado se actualiza igualmente cuando el usuario avisa al bot (vía `consultar_reserva`).

En producción con dominio real, el webhook llega automáticamente y confirma la reserva sin intervención del usuario.

### Simular el webhook manualmente (desarrollo)

1. Hacer un pago de prueba con usuario comprador sandbox
2. Obtener el Payment ID:
```powershell
Invoke-WebRequest -Uri "https://api.mercadopago.com/v1/payments/search?sort=date_created&criteria=desc" -Headers @{"Authorization" = "Bearer APP_USR-6393464285674842-052011-bb466e01ed3c8788ed69291245a613d0-1428995581"} | Select-Object -ExpandProperty Content
```
3. Buscar el `"id"` del pago de Roomly (ver `"description"` que contenga "Hotel Roomly")
4. Disparar el webhook:
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/v1/payments/webhook" -Method POST -ContentType "application/json" -Body '{"type":"payment","data":{"id":"PAYMENT_ID_AQUI"}}'
```
5. La reserva pasa a `CONFIRMED` en la DB

---

## Cuentas de prueba sandbox

Para pagar en sandbox necesitás un **usuario comprador de prueba** (no tu cuenta real de MP).

- Crear en: [developers.mercadopago.com](https://www.mercadopago.com.ar/developers/panel) → Tu app → **Cuentas de prueba** → Crear cuenta (tipo Comprador)
- Pagar usando "Dinero en cuenta" (account_money) del usuario comprador, o con tarjeta de prueba

### Tarjetas de prueba
| Tipo | Número | CVV | Vencimiento |
|------|--------|-----|-------------|
| Visa (aprobada) | `4509 9535 6623 3704` | `123` | Cualquier fecha futura |
| Mastercard (rechazada) | `5031 7557 3453 0604` | `123` | Cualquier fecha futura |

Nombre del titular: `APRO` (para aprobar) / `OTHE` (para rechazar)

---

## Auto-cancelación a las 24h

BullMQ encola un job `EXPIRE_PAYMENT` con 24h de delay al crear la preferencia.  
Si la reserva sigue en `PENDING_PAYMENT` al ejecutarse → pasa a `CANCELLED`.

Para cancelar jobs pendientes en desarrollo (limpiar la DB):
```sql
UPDATE "Reservation" SET status = 'CANCELLED' WHERE status = 'PENDING_PAYMENT';
```

---

## Pasar a producción

1. Reemplazar `MP_ACCESS_TOKEN` por el token productivo
2. Configurar `NEXTAUTH_URL` con el dominio real (ej: `https://roomly.mihotel.com`)
3. MP enviará webhooks automáticamente → no es necesario que el usuario avise al bot
4. Quitar la cuenta de producción del modo "sandbox" en el panel de MP
