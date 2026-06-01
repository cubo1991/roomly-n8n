import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateRatePlanSchema } from "@/lib/validations";

/**
 * GET /api/v1/rate-plans?hotelId=<id>[&typeId=<id>]
 * Returns rate plans for a hotel, optionally filtered by room type.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const hotelId = searchParams.get("hotelId");
  const typeId = searchParams.get("typeId");

  if (!hotelId) {
    return NextResponse.json({ error: "hotelId is required" }, { status: 400 });
  }

  try {
    const plans = await prisma.ratePlan.findMany({
      where: {
        hotelId,
        ...(typeId ? { typeId } : {}),
      },
      include: {
        type: { select: { name: true } },
      },
      orderBy: [{ typeId: "asc" }, { validFrom: "asc" }],
    });

    return NextResponse.json(plans);
  } catch (err) {
    console.error("[GET /rate-plans]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/v1/rate-plans
 * Create a new rate plan.
 * Body: { hotelId, typeId, name, pricePerNight, validFrom, validTo, minNights? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateRatePlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const plan = await prisma.ratePlan.create({
      data: {
        ...parsed.data,
        validFrom: new Date(parsed.data.validFrom),
        validTo: new Date(parsed.data.validTo),
      },
      include: { type: { select: { name: true } } },
    });

    return NextResponse.json(plan, { status: 201 });
  } catch (err) {
    console.error("[POST /rate-plans]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
