import { Preference, Payment as MPPayment } from "mercadopago";
import { mpClient } from "@/lib/mercadopago";
import { prisma } from "@/lib/prisma";
import { reservationQueue } from "@/lib/queue";

const BACKEND_URL = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

// ─── Crear preferencia de pago ────────────────────────────────────────────────

/**
 * Crea una preferencia de Mercado Pago para una reserva en estado PENDING_PAYMENT.
 * Devuelve la URL de pago y los datos del hotel para el mensaje de WhatsApp.
 *
 * @param reservationId  ID interno de la reserva
 * @param paymentType    DEPOSIT (15%) o FULL (total)
 */
export async function createPaymentPreference(
  reservationId: string,
  paymentType: "DEPOSIT" | "FULL"
) {
  const reservation = await prisma.reservation.findUniqueOrThrow({
    where: { id: reservationId },
    include: {
      room:     { select: { number: true } },
      ratePlan: { select: { pricePerNight: true } },
      hotel:    { select: { name: true, email: true, phone: true } },
    },
  });

  if (!reservation.ratePlan) {
    throw new Error("La reserva no tiene tarifa asignada — no se puede calcular el monto.");
  }

  const nights = Math.round(
    (reservation.checkOut.getTime() - reservation.checkIn.getTime()) / 86400000
  );
  const totalPrice  = Number(reservation.ratePlan.pricePerNight) * nights;
  const payAmount   = paymentType === "DEPOSIT" ? Math.round(totalPrice * 0.15) : totalPrice;
  const expiresAt   = new Date(Date.now() + 24 * 60 * 60 * 1000); // +24 h

  const preference = new Preference(mpClient);
  const mpResponse = await preference.create({
    body: {
      items: [
        {
          id:         reservation.id,
          title:      `${paymentType === "DEPOSIT" ? "Seña (15%)" : "Pago total"} – ${reservation.hotel.name} · Hab. ${reservation.room.number} · ${reservation.code}`,
          quantity:   1,
          unit_price: payAmount,
          currency_id: "ARS",
        },
      ],
      external_reference: reservation.id,
      notification_url:   `${BACKEND_URL}/api/v1/payments/webhook`,
      // La preferencia expira en 24 h (igual que el deadline de la reserva)
      expires:                true,
      expiration_date_from:   new Date().toISOString(),
      expiration_date_to:     expiresAt.toISOString(),
    },
  });

  // Guardar el pago en la DB
  await prisma.payment.create({
    data: {
      hotelId:       reservation.hotelId,
      reservationId: reservation.id,
      mpPreferenceId: mpResponse.id ?? undefined,
      amount:         payAmount,
      currency:       "ARS",
      status:         "PENDING",
      paymentType,
      expiresAt,
    },
  });

  // Encolar auto-cancelación a las 24 h
  await reservationQueue.add(
    "expire_payment",
    { type: "EXPIRE_PAYMENT", reservationId: reservation.id },
    { delay: 24 * 60 * 60 * 1000, jobId: `expire-${reservation.id}` }
  );

  return {
    paymentUrl:  mpResponse.init_point!,
    payAmount,
    totalPrice,
    paymentType,
    expiresAt,
    hotelEmail:  reservation.hotel.email,
    hotelPhone:  reservation.hotel.phone,
  };
}

// ─── Procesar webhook de MP ───────────────────────────────────────────────────

/**
 * Consulta el estado de un pago en MP y actualiza la DB.
 * Si el pago fue aprobado → confirma la reserva y notifica al huésped.
 */
export async function handleMPWebhook(mpPaymentId: string) {
  const paymentClient = new MPPayment(mpClient);
  const info = await paymentClient.get({ id: String(mpPaymentId) });

  const reservationId = info.external_reference;
  if (!reservationId) {
    console.warn("[MP webhook] external_reference vacío — se ignora.");
    return;
  }

  const payment = await prisma.payment.findUnique({
    where: { reservationId },
  });
  if (!payment) {
    console.warn(`[MP webhook] No existe Payment para reservationId ${reservationId}`);
    return;
  }

  const newStatus =
    info.status === "approved" ? "APPROVED" :
    info.status === "rejected" ? "REJECTED"  :
    "PENDING";

  await prisma.payment.update({
    where: { reservationId },
    data: { status: newStatus, mpPaymentId: String(info.id ?? "") },
  });

  if (newStatus === "APPROVED") {
    // Confirmar la reserva
    await prisma.$transaction(async (tx) => {
      await tx.reservation.update({
        where: { id: reservationId },
        data:  { status: "CONFIRMED" },
      });
      await tx.auditLog.create({
        data: {
          reservationId,
          action:      "PAYMENT_APPROVED",
          after:       { mpPaymentId, amount: Number(payment.amount), paymentType: payment.paymentType } as object,
          performedBy: "mercadopago",
        },
      });
    });

    // Encolar jobs que se saltaron al crear la reserva como PENDING_PAYMENT
    await reservationQueue.add("payment_confirmed", {
      type:          "SEND_PAYMENT_CONFIRMED",
      reservationId,
      mpPaymentId,
      paymentType:   payment.paymentType,
      amount:        Number(payment.amount),
    });
    await reservationQueue.add("housekeeping", {
      type: "SCHEDULE_HOUSEKEEPING",
      reservationId,
    });

    // Eliminar el job de auto-cancelación (ya no hace falta)
    await reservationQueue.remove(`expire-${reservationId}`).catch(() => null);

    console.log(`[MP webhook] Reserva ${reservationId} CONFIRMADA — pago ${mpPaymentId}`);
  }

  if (newStatus === "REJECTED") {
    console.log(`[MP webhook] Pago ${mpPaymentId} rechazado — reserva ${reservationId} sigue PENDING_PAYMENT`);
  }
}

// ─── Auto-expiración (llamada desde BullMQ) ───────────────────────────────────

/**
 * Cancela una reserva si sigue en PENDING_PAYMENT pasadas las 24 h.
 */
export async function expirePayment(reservationId: string) {
  const payment = await prisma.payment.findUnique({ where: { reservationId } });
  if (!payment || payment.status !== "PENDING") return; // ya fue pagado

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { reservationId },
      data:  { status: "EXPIRED" },
    });
    await tx.reservation.update({
      where: { id: reservationId },
      data:  { status: "CANCELLED" },
    });
    await tx.auditLog.create({
      data: {
        reservationId,
        action:      "PAYMENT_EXPIRED",
        after:       { reason: "24h sin pago" } as object,
        performedBy: "system",
      },
    });
  });

  console.log(`[Queue] Reserva ${reservationId} cancelada por falta de pago (24 h)`);
}
