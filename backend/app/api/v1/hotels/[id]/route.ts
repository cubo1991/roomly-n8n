import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateHotelSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/hotels/:id
 * Returns the hotel with room/reservation/guest counts.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const hotel = await prisma.hotel.findUnique({
      where: { id },
      include: {
        roomTypes: {
          include: { _count: { select: { rooms: true } } },
          orderBy: { name: "asc" },
        },
        _count: { select: { rooms: true, reservations: true, guests: true } },
      },
    });

    if (!hotel) {
      return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
    }

    return NextResponse.json(hotel);
  } catch (err) {
    console.error("[GET /hotels/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/hotels/:id
 * Update hotel info (name, address, phone, email, timezone).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = UpdateHotelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const hotel = await prisma.hotel.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(hotel);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
    }
    console.error("[PATCH /hotels/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
