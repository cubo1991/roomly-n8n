import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateRoomSchema } from "@/lib/validations";
import { getAvailableRooms } from "@/services/availability.service";

/**
 * GET /api/v1/rooms
 * Query params: hotelId, checkIn, checkOut (returns available rooms for date range)
 * Without dates: returns all rooms for the hotel
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const hotelId = searchParams.get("hotelId");
    const checkIn = searchParams.get("checkIn");
    const checkOut = searchParams.get("checkOut");

    if (!hotelId) {
      return NextResponse.json({ error: "hotelId is required" }, { status: 400 });
    }

    if (checkIn && checkOut) {
      const available = await getAvailableRooms(hotelId, checkIn, checkOut);
      return NextResponse.json(available);
    }

    const rooms = await prisma.room.findMany({
      where: { hotelId },
      include: { type: { select: { name: true, maxGuests: true } } },
      orderBy: [{ floor: "asc" }, { number: "asc" }],
    });

    return NextResponse.json(rooms);
  } catch (err) {
    console.error("[GET /rooms]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/v1/rooms
 * Body: CreateRoomSchema
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateRoomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const room = await prisma.room.create({
      data: parsed.data,
      include: { type: { select: { name: true } } },
    });

    return NextResponse.json(room, { status: 201 });
  } catch (err) {
    console.error("[POST /rooms]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
