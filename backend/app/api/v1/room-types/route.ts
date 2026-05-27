import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateRoomTypeSchema } from "@/lib/validations";

/**
 * GET /api/v1/room-types?hotelId=<id>
 * Returns all room types for a hotel, with room count per type.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const hotelId = searchParams.get("hotelId");

  if (!hotelId) {
    return NextResponse.json({ error: "hotelId is required" }, { status: 400 });
  }

  try {
    const types = await prisma.roomType.findMany({
      where: { hotelId },
      include: {
        _count: { select: { rooms: true, ratePlans: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(types);
  } catch (err) {
    console.error("[GET /room-types]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/v1/room-types
 * Create a new room type.
 * Body: { hotelId, name, description?, maxGuests?, amenities? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateRoomTypeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const type = await prisma.roomType.create({ data: parsed.data });
    return NextResponse.json(type, { status: 201 });
  } catch (err) {
    console.error("[POST /room-types]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
