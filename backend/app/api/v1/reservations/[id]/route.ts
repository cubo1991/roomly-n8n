import { NextRequest, NextResponse } from "next/server";
import { UpdateReservationSchema } from "@/lib/validations";
import {
  findReservationByCode,
  updateReservation,
  cancelReservation,
} from "@/services/reservation.service";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

/**
 * GET /api/v1/reservations/:id
 * :id can be either a Prisma cuid OR an RML-XXXX code
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = params;

    let reservation;
    if (id.startsWith("RML-")) {
      reservation = await findReservationByCode(id);
    } else {
      reservation = await prisma.reservation.findUnique({
        where: { id },
        include: {
          room: { select: { number: true, floor: true } },
          guest: { select: { name: true, phone: true, email: true } },
          ratePlan: { select: { name: true, pricePerNight: true } },
        },
      });
    }

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    return NextResponse.json(reservation);
  } catch (err) {
    console.error("[GET /reservations/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/reservations/:id
 * Body: UpdateReservationSchema
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const body = await req.json();
    const parsed = UpdateReservationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const updated = await updateReservation(params.id, parsed.data);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("not available") ? 409 : 500;
    console.error("[PATCH /reservations/:id]", err);
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/v1/reservations/:id
 * Soft-cancel (sets status = CANCELLED)
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const cancelled = await cancelReservation(params.id);
    return NextResponse.json(cancelled);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[DELETE /reservations/:id]", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
