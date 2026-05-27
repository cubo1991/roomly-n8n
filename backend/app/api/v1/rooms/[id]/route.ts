import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateRoomSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/rooms/:id
 * Returns a single room with its type and active reservations count.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        type: true,
        _count: {
          select: {
            reservations: {
              where: { status: { in: ["CONFIRMED", "CHECKED_IN"] } },
            },
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    return NextResponse.json(room);
  } catch (err) {
    console.error("[GET /rooms/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/rooms/:id
 * Update room data: number, floor, typeId, status, notes.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = UpdateRoomSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const room = await prisma.room.update({
      where: { id },
      data: parsed.data,
      include: { type: { select: { name: true, maxGuests: true } } },
    });

    return NextResponse.json(room);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    console.error("[PATCH /rooms/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/rooms/:id
 * Deletes a room. Blocked if the room has active (CONFIRMED/CHECKED_IN) reservations.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    // Guard: reject if active reservations exist
    const activeCount = await prisma.reservation.count({
      where: {
        roomId: id,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
    });

    if (activeCount > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete room with active reservations",
          activeReservations: activeCount,
        },
        { status: 409 }
      );
    }

    await prisma.room.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    console.error("[DELETE /rooms/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
