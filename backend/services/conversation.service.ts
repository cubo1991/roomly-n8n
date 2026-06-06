import { prisma } from "@/lib/prisma";
import type { LogMessageInput } from "@/lib/validations";

/** Parse the WhatsApp timestamp (unix seconds, as string/number) or ISO date. */
function parseWaTimestamp(ts: string | number | undefined): Date | null {
  if (ts === undefined || ts === null || ts === "") return null;
  if (typeof ts === "number") return new Date(ts * 1000);
  // numeric string → unix seconds; otherwise try ISO
  if (/^\d+$/.test(ts)) return new Date(parseInt(ts, 10) * 1000);
  const d = new Date(ts);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Persist a WhatsApp turn (user message + bot reply) as individual Message rows.
 * Stores the full thread per phone; the per-reservation view is derived later.
 */
export async function logInteraction(input: LogMessageInput) {
  const channel = input.channel ?? "WHATSAPP";

  // Resolve hotel (single-tenant fallback) and guest by phone, if they exist.
  let hotelId = input.hotelId ?? null;
  if (!hotelId) {
    const hotel = await prisma.hotel.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    hotelId = hotel?.id ?? null;
  }

  const guest = await prisma.guest.findFirst({
    where: { phone: input.phone, ...(hotelId ? { hotelId } : {}) },
    select: { id: true },
  });

  // Timestamps: inbound at the WhatsApp message time (or now); outbound right after.
  const now = Date.now();
  const inboundAt = parseWaTimestamp(input.waTimestamp) ?? new Date(now);
  const outboundAt = new Date(Math.max(now, inboundAt.getTime() + 1000));

  const rows: {
    hotelId: string | null;
    phone: string;
    guestId: string | null;
    direction: "INBOUND" | "OUTBOUND";
    content: string;
    channel: typeof channel;
    waTimestamp: Date | null;
    createdAt: Date;
  }[] = [];

  if (input.userMessage?.trim()) {
    rows.push({
      hotelId,
      phone: input.phone,
      guestId: guest?.id ?? null,
      direction: "INBOUND",
      content: input.userMessage.trim(),
      channel,
      waTimestamp: inboundAt,
      createdAt: inboundAt,
    });
  }

  if (input.botMessage?.trim()) {
    rows.push({
      hotelId,
      phone: input.phone,
      guestId: guest?.id ?? null,
      direction: "OUTBOUND",
      content: input.botMessage.trim(),
      channel,
      waTimestamp: null,
      createdAt: outboundAt,
    });
  }

  if (rows.length === 0) return { count: 0 };
  return prisma.message.createMany({ data: rows });
}

export type ChatMessage = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  content: string;
  createdAt: Date;
};

/**
 * Returns the chat slice around a reservation: messages of that phone between the
 * previous reservation of the same guest and this one (+ a buffer to include the
 * confirmation turn, which is logged just after creation). Heuristic — the full
 * thread is always stored intact.
 */
export async function getReservationChat(
  reservationId: string
): Promise<ChatMessage[]> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      guestId: true,
      createdAt: true,
      guest: { select: { phone: true } },
    },
  });
  if (!reservation) return [];

  const [prev, next] = await Promise.all([
    prisma.reservation.findFirst({
      where: { guestId: reservation.guestId, createdAt: { lt: reservation.createdAt } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.reservation.findFirst({
      where: { guestId: reservation.guestId, createdAt: { gt: reservation.createdAt } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);

  const BUFFER_MS = 5 * 60 * 1000;
  const lower = prev?.createdAt ?? new Date(0);
  let upper = new Date(reservation.createdAt.getTime() + BUFFER_MS);
  if (next && next.createdAt < upper) upper = next.createdAt;

  const messages = await prisma.message.findMany({
    where: {
      phone: reservation.guest.phone,
      createdAt: { gt: lower, lte: upper },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, direction: true, content: true, createdAt: true },
  });

  return messages;
}
