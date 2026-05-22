import { prisma } from "@/lib/prisma";
import { reservationQueue } from "@/lib/queue";
import { isRoomAvailable } from "./availability.service";
import type { CreateReservationInput, UpdateReservationInput } from "@/lib/validations";

// ─── Code generator ────────────────────────────────────────────────────────────

function generateRmlCode(): string {
  const num = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `RML-${num}`;
}

async function uniqueCode(): Promise<string> {
  let code: string;
  let exists: boolean;
  do {
    code = generateRmlCode();
    const existing = await prisma.reservation.findUnique({
      where: { code },
      select: { id: true },
    });
    exists = existing !== null;
  } while (exists);
  return code;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createReservation(input: CreateReservationInput) {
  const { hotelId, roomId, guest, checkIn, checkOut, numGuests, channel, ratePlanId, notes } = input;

  // 1. Check availability (application-level guard; DB constraint is the final safety net)
  const available = await isRoomAvailable(roomId, checkIn, checkOut);
  if (!available) {
    throw new Error(`Room is not available from ${checkIn} to ${checkOut}`);
  }

  // 2. Use provided code or generate a unique one
  const code = input.code ?? (await uniqueCode());

  // 3. Upsert guest (find by hotel + phone, create if new)
  const guestRecord = await prisma.guest.upsert({
    where: { hotelId_phone: { hotelId, phone: guest.phone } },
    update: { name: guest.name, email: guest.email ?? undefined, dni: guest.dni ?? undefined },
    create: {
      hotelId,
      name: guest.name,
      phone: guest.phone,
      email: guest.email,
      dni: guest.dni,
    },
  });

  // 4. Create reservation inside a transaction
  const reservation = await prisma.$transaction(async (tx) => {
    const res = await tx.reservation.create({
      data: {
        hotelId,
        roomId,
        guestId: guestRecord.id,
        ratePlanId,
        code,
        status: "CONFIRMED",
        channel,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        numGuests,
        notes,
      },
      include: {
        room: { select: { number: true } },
        guest: { select: { name: true, phone: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        reservationId: res.id,
        action: "CREATED",
        after: res as object,
        performedBy: channel === "WHATSAPP" ? "n8n" : "admin",
      },
    });

    return res;
  });

  // 5. Enqueue async jobs (fire-and-forget)
  await Promise.allSettled([
    reservationQueue.add("confirmation", {
      type: "SEND_CONFIRMATION",
      reservationId: reservation.id,
    }),
    reservationQueue.add("housekeeping", {
      type: "SCHEDULE_HOUSEKEEPING",
      reservationId: reservation.id,
    }),
  ]);

  return reservation;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateReservation(
  id: string,
  input: UpdateReservationInput,
  performedBy = "admin"
) {
  const current = await prisma.reservation.findUniqueOrThrow({
    where: { id },
  });

  // If dates are changing, check availability
  if (input.checkIn || input.checkOut || input.roomId) {
    const newRoomId = input.roomId ?? current.roomId;
    const newCheckIn = input.checkIn ?? current.checkIn.toISOString().split("T")[0];
    const newCheckOut = input.checkOut ?? current.checkOut.toISOString().split("T")[0];

    const available = await isRoomAvailable(newRoomId, newCheckIn, newCheckOut, id);
    if (!available) {
      throw new Error(`Room is not available for the requested dates`);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.reservation.update({
      where: { id },
      data: {
        ...(input.checkIn && { checkIn: new Date(input.checkIn) }),
        ...(input.checkOut && { checkOut: new Date(input.checkOut) }),
        ...(input.numGuests !== undefined && { numGuests: input.numGuests }),
        ...(input.status && { status: input.status }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.roomId && { roomId: input.roomId }),
      },
      include: {
        room: { select: { number: true } },
        guest: { select: { name: true, phone: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        reservationId: id,
        action: "MODIFIED",
        before: current as object,
        after: res as object,
        performedBy,
      },
    });

    return res;
  });

  return updated;
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export async function cancelReservation(id: string, performedBy = "admin") {
  const current = await prisma.reservation.findUniqueOrThrow({ where: { id } });

  if (["CANCELLED", "CHECKED_OUT"].includes(current.status)) {
    throw new Error(`Reservation is already ${current.status}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.reservation.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    await tx.auditLog.create({
      data: {
        reservationId: id,
        action: "CANCELLED",
        before: current as object,
        after: res as object,
        performedBy,
      },
    });

    return res;
  });

  return updated;
}

// ─── Query ────────────────────────────────────────────────────────────────────

export async function findReservationByCode(code: string) {
  return prisma.reservation.findUnique({
    where: { code },
    include: {
      room: { select: { number: true, floor: true } },
      guest: { select: { name: true, phone: true, email: true } },
      ratePlan: { select: { name: true, pricePerNight: true } },
    },
  });
}

export async function listReservations(hotelId: string, options?: {
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const { status, from, to, page = 1, pageSize = 20 } = options ?? {};
  const skip = (page - 1) * pageSize;

  const where = {
    hotelId,
    ...(status && { status: status as never }),
    ...(from && { checkIn: { gte: new Date(from) } }),
    ...(to && { checkOut: { lte: new Date(to) } }),
  };

  const [reservations, total] = await prisma.$transaction([
    prisma.reservation.findMany({
      where,
      include: {
        room: { select: { number: true } },
        guest: { select: { name: true, phone: true } },
      },
      orderBy: { checkIn: "asc" },
      skip,
      take: pageSize,
    }),
    prisma.reservation.count({ where }),
  ]);

  return { reservations, total, page, pageSize, pages: Math.ceil(total / pageSize) };
}
