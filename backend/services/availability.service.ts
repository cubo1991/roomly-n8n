import { prisma } from "@/lib/prisma";

/**
 * Check if a room is available for a given date range.
 *
 * Uses half-open interval [checkIn, checkOut) to match the
 * PostgreSQL EXCLUDE USING GIST daterange logic.
 *
 * @param roomId   - Prisma Room.id
 * @param checkIn  - "YYYY-MM-DD"
 * @param checkOut - "YYYY-MM-DD"
 * @param excludeReservationId - Skip this reservation (use when modifying)
 */
export async function isRoomAvailable(
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeReservationId?: string
): Promise<boolean> {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  // Count overlapping, non-cancelled reservations
  const conflict = await prisma.reservation.findFirst({
    where: {
      roomId,
      id: excludeReservationId ? { not: excludeReservationId } : undefined,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      // Overlap condition: existing.checkIn < new.checkOut AND existing.checkOut > new.checkIn
      AND: [
        { checkIn: { lt: checkOutDate } },
        { checkOut: { gt: checkInDate } },
      ],
    },
    select: { id: true, code: true },
  });

  return conflict === null;
}

/**
 * Get all available rooms for a hotel in a date range.
 * Returns rooms with their type information.
 */
export async function getAvailableRooms(
  hotelId: string,
  checkIn: string,
  checkOut: string
) {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  // Find room IDs that ARE conflicting
  const conflictingReservations = await prisma.reservation.findMany({
    where: {
      hotelId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      AND: [
        { checkIn: { lt: checkOutDate } },
        { checkOut: { gt: checkInDate } },
      ],
    },
    select: { roomId: true },
  });

  const occupiedRoomIds = conflictingReservations.map((r) => r.roomId);

  const rooms = await prisma.room.findMany({
    where: {
      hotelId,
      status: { in: ["AVAILABLE"] },
      id: occupiedRoomIds.length > 0 ? { notIn: occupiedRoomIds } : undefined,
    },
    include: {
      type: {
        select: {
          name: true,
          maxGuests: true,
          amenities: true,
          ratePlans: {
            select: { pricePerNight: true, name: true },
            orderBy: { validFrom: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { number: "asc" },
  });

  // Flatten pricePerNight so the AI agent receives it as a plain number
  return rooms.map((room) => ({
    id: room.id,
    number: room.number,
    floor: room.floor,
    status: room.status,
    type: {
      name: room.type.name,
      maxGuests: room.type.maxGuests,
      amenities: room.type.amenities,
    },
    pricePerNight: room.type.ratePlans[0]
      ? Number(room.type.ratePlans[0].pricePerNight)
      : null,
    ratePlanName: room.type.ratePlans[0]?.name ?? null,
  }));
}

/**
 * Returns a grid of all rooms with their status for a specific date range.
 * Used by the dashboard room grid component.
 */
export async function getRoomStatusGrid(
  hotelId: string,
  checkIn: string,
  checkOut: string
) {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);

  const rooms = await prisma.room.findMany({
    where: { hotelId },
    include: {
      type: {
        select: {
          name: true,
          ratePlans: {
            select: { pricePerNight: true },
            orderBy: { validFrom: "desc" },
            take: 1,
          },
        },
      },
      reservations: {
        where: {
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          AND: [
            { checkIn: { lt: checkOutDate } },
            { checkOut: { gt: checkInDate } },
          ],
        },
        include: { guest: { select: { name: true, phone: true } } },
        take: 1,
      },
    },
    orderBy: [{ floor: "asc" }, { number: "asc" }],
  });

  return rooms.map((room) => ({
    id: room.id,
    number: room.number,
    floor: room.floor,
    typeName: room.type.name,
    pricePerNight: room.type.ratePlans[0]
      ? Number(room.type.ratePlans[0].pricePerNight)
      : null,
    status: room.reservations.length > 0 ? "OCCUPIED" : room.status,
    reservation: room.reservations[0] ?? null,
  }));
}
