import { Queue, Worker, type Job } from "bullmq";
import { redis } from "./redis";
import { prisma } from "./prisma";

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
  | { type: "SCHEDULE_HOUSEKEEPING"; reservationId: string };

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
      }
    },
    { connection: redis }
  );

  worker.on("failed", (job, err) => {
    console.error(`[Queue] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
