import { Queue, Worker, type Job } from "bullmq";
import { redis } from "./redis";
import { prisma } from "./prisma";
import { expirePayment } from "@/services/payment.service";

// ─── Queue definitions ────────────────────────────────────────────────────────

export const reservationQueue = new Queue("reservations", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// ─── Job types ────────────────────────────────────────────────────────────────

export type ReservationJobData =
  | { type: "SEND_CONFIRMATION"; reservationId: string }
  | { type: "SCHEDULE_CHECKIN_REMINDER"; reservationId: string }
  | { type: "SCHEDULE_HOUSEKEEPING"; reservationId: string }
  | { type: "EXPIRE_PAYMENT"; reservationId: string }
  | { type: "SEND_PAYMENT_CONFIRMED"; reservationId: string; mpPaymentId: string; paymentType: string; amount: number };

// ─── Worker (runs in a separate process in production) ────────────────────────

export function startReservationWorker() {
  const worker = new Worker<ReservationJobData>(
    "reservations",
    async (job: Job<ReservationJobData>) => {
      const data = job.data;

      switch (data.type) {
        case "SEND_CONFIRMATION": {
          const res = await prisma.reservation.findUnique({
            where: { id: data.reservationId },
            include: { guest: true, room: true },
          });
          if (!res) return;
          // TODO: send WhatsApp confirmation via n8n webhook or WABA API
          console.log(
            `[Queue] Confirmation queued for ${res.code} → ${res.guest.phone}`
          );
          break;
        }

        case "SCHEDULE_CHECKIN_REMINDER": {
          const res = await prisma.reservation.findUnique({
            where: { id: data.reservationId },
            include: { guest: true },
          });
          if (!res) return;
          console.log(
            `[Queue] Check-in reminder queued for ${res.code} → ${res.guest.phone}`
          );
          break;
        }

        case "SCHEDULE_HOUSEKEEPING": {
          const res = await prisma.reservation.findUnique({
            where: { id: data.reservationId },
            include: { room: true },
          });
          if (!res) return;
          await prisma.housekeepingTask.create({
            data: {
              roomId: res.roomId,
              reservationId: res.id,
              scheduledFor: res.checkOut,
              status: "PENDING",
              notes: `Post-checkout – ${res.code}`,
            },
          });
          console.log(`[Queue] Housekeeping task created for ${res.code}`);
          break;
        }

        case "EXPIRE_PAYMENT": {
          await expirePayment(data.reservationId);
          break;
        }

        case "SEND_PAYMENT_CONFIRMED": {
          const res = await prisma.reservation.findUnique({
            where: { id: data.reservationId },
            include: {
              guest: true,
              room:  { select: { number: true } },
              hotel: { select: { name: true } },
            },
          });
          if (!res) return;

          const typeLabel = data.paymentType === "DEPOSIT" ? "seña (15%)" : "pago total";
          const checkInStr = res.checkIn.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
          const checkOutStr = res.checkOut.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
          const msg =
            `✅ ¡Pago recibido! Tu reserva *${res.code}* en ${res.hotel.name} está *confirmada*.\n` +
            `🛏️ Hab. ${res.room.number} · Check-in: ${checkInStr} · Check-out: ${checkOutStr}\n` +
            `💰 Se acreditó tu ${typeLabel} de $${data.amount.toLocaleString("es-AR")}.\n\n` +
            `¡Te esperamos! 🏨`;

          // Enviar via n8n (usa el canal WhatsApp ya configurado)
          await notifyViaWhatsApp(res.guest.phone, msg);

          // Marcar notificación
          await prisma.payment.update({
            where: { reservationId: data.reservationId },
            data:  { notifiedAt: new Date() },
          });

          console.log(`[Queue] Notificación de pago enviada → ${res.guest.phone}`);
          break;
        }
      }
    },
    { connection: redis }
  );

  worker.on("failed", (job, err) => {
    console.error(`[Queue] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}

// ─── Helper: enviar mensaje via n8n (que usa el canal WhatsApp configurado) ───

async function notifyViaWhatsApp(phone: string, message: string): Promise<void> {
  const n8nBaseUrl          = process.env.N8N_BASE_URL ?? "http://localhost:5678";
  const phoneNumberId       = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!phoneNumberId) {
    console.warn("[WhatsApp] WHATSAPP_PHONE_NUMBER_ID no configurado. Mensaje no enviado.");
    return;
  }

  // Argentina quirk: la Cloud API requiere 54XX... (sin el 9 de móvil)
  const recipient = phone.replace(/^549/, "54");

  const res = await fetch(`${n8nBaseUrl}/webhook/payment-confirmed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone:         recipient,
      phoneNumberId,
      message,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`n8n webhook error: ${err}`);
  }
}
