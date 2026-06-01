import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateRatePlanSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/rate-plans/:id
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const plan = await prisma.ratePlan.findUnique({
      where: { id },
      include: { type: { select: { name: true, maxGuests: true } } },
    });

    if (!plan) {
      return NextResponse.json({ error: "Rate plan not found" }, { status: 404 });
    }

    return NextResponse.json(plan);
  } catch (err) {
    console.error("[GET /rate-plans/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/rate-plans/:id
 * Update name, pricePerNight, validFrom, validTo, minNights.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = UpdateRatePlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { validFrom, validTo, ...rest } = parsed.data;

    const plan = await prisma.ratePlan.update({
      where: { id },
      data: {
        ...rest,
        ...(validFrom ? { validFrom: new Date(validFrom) } : {}),
        ...(validTo ? { validTo: new Date(validTo) } : {}),
      },
      include: { type: { select: { name: true } } },
    });

    return NextResponse.json(plan);
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Rate plan not found" }, { status: 404 });
    }
    console.error("[PATCH /rate-plans/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/v1/rate-plans/:id
 * Blocked if the plan has reservations linked to it.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const reservationCount = await prisma.reservation.count({
      where: {
        ratePlanId: id,
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
    });

    if (reservationCount > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete rate plan with active reservations",
          activeReservations: reservationCount,
        },
        { status: 409 }
      );
    }

    await prisma.ratePlan.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2025"
    ) {
      return NextResponse.json({ error: "Rate plan not found" }, { status: 404 });
    }
    console.error("[DELETE /rate-plans/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
