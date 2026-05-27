import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateRoomTypeSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/room-types/:id
 * Returns a room type with its rooms and rate plans.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const type = await prisma.roomType.findUnique({
      where: { id },
      include: {
        rooms: { orderBy: [{ floor: "asc" }, { number: "asc" }] },
        ratePlans: { orderBy: { validFrom: "asc" } },
      },
    });

    if (!type) {
      return NextResponse.json({ error: "Room type not found" }, { status: 404 });
    }

    return NextResponse.json(type);
  } catch (err) {
    console.error("[GET /room-types/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/room-types/:id
 * Update name, description, maxGuests or amenities.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = UpdateRoomTypeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const type = await prisma.roomType.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(type);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Room type not found" }, { status: 404 });
    }
    console.error("[PATCH /room-types/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/room-types/:id
 * Blocked if the type has rooms assigned to it.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const roomCount = await prisma.room.count({ where: { typeId: id } });

    if (roomCount > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete room type that has rooms assigned",
          roomCount,
        },
        { status: 409 }
      );
    }

    await prisma.roomType.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Room type not found" }, { status: 404 });
    }
    console.error("[DELETE /room-types/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
