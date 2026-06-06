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

const RML_CODE_RE = /RML-\d{4}/;

/**
 * Returns the chat for a reservation, delimited by the RML confirmation messages.
 *
 * Cada reserva se confirma con su código "RML-XXXX" en un mensaje del bot. Ese
 * mensaje marca el FIN de una conversación de reserva. Por eso el chat de la
 * reserva = los mensajes desde DESPUÉS de la confirmación anterior y HASTA su
 * propia confirmación (inclusive). Así no se filtra la confirmación de la reserva
 * previa en la siguiente. Si no se encuentra el mensaje de confirmación (p. ej.
 * reservas creadas desde el dashboard, sin chat), cae a una ventana temporal.
 */
export async function getReservationChat(
  reservationId: string
): Promise<ChatMessage[]> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      code: true,
      guestId: true,
      createdAt: true,
      guest: { select: { phone: true } },
    },
  });
  if (!reservation) return [];

  // Hilo completo del teléfono (no es grande por número).
  const all = await prisma.message.findMany({
    where: { phone: reservation.guest.phone },
    orderBy: { createdAt: "asc" },
    select: { id: true, direction: true, content: true, createdAt: true },
  });
  if (all.length === 0) return [];

  // Fin: el mensaje del bot que confirma ESTA reserva (contiene su RML).
  const endIdx = all.findIndex(
    (m) => m.direction === "OUTBOUND" && m.content.includes(reservation.code)
  );

  if (endIdx === -1) {
    // Fallback temporal: reserva sin mensaje de confirmación identificable.
    return getReservationChatByTime(reservation.guestId, reservation.createdAt, all);
  }

  // Inicio: la confirmación anterior (cualquier RML) antes de endIdx; se excluye.
  let startIdx = -1;
  for (let i = endIdx - 1; i >= 0; i--) {
    if (all[i].direction === "OUTBOUND" && RML_CODE_RE.test(all[i].content)) {
      startIdx = i;
      break;
    }
  }

  return all.slice(startIdx + 1, endIdx + 1);
}

/** Fallback: ventana temporal entre la reserva anterior del mismo guest y esta. */
async function getReservationChatByTime(
  guestId: string,
  createdAt: Date,
  all: ChatMessage[]
): Promise<ChatMessage[]> {
  const prev = await prisma.reservation.findFirst({
    where: { guestId, createdAt: { lt: createdAt } },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const BUFFER_MS = 5 * 60 * 1000;
  const lower = prev?.createdAt ?? new Date(0);
  const upper = new Date(createdAt.getTime() + BUFFER_MS);
  return all.filter((m) => m.createdAt > lower && m.createdAt <= upper);
}
