import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateGuestSchema } from "@/lib/validations";

/**
 * GET /api/v1/guests
 * Query params: hotelId, phone, name (search)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const hotelId = searchParams.get("hotelId");
    const phone = searchParams.get("phone");
    const name = searchParams.get("name");

    if (!hotelId) {
      return NextResponse.json({ error: "hotelId is required" }, { status: 400 });
    }

    const guests = await prisma.guest.findMany({
      where: {
        hotelId,
        ...(phone && { phone: { contains: phone } }),
        ...(name && { name: { contains: name, mode: "insensitive" } }),
      },
      include: {
        _count: { select: { reservations: true } },
      },
      orderBy: { name: "asc" },
      take: 50,
    });

    return NextResponse.json(guests);
  } catch (err) {
    console.error("[GET /guests]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/v1/guests
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateGuestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const guest = await prisma.guest.upsert({
      where: {
        hotelId_phone: {
          hotelId: parsed.data.hotelId,
          phone: parsed.data.phone,
        },
      },
      update: { name: parsed.data.name, email: parsed.data.email },
      create: parsed.data,
    });

    return NextResponse.json(guest, { status: 201 });
  } catch (err) {
    console.error("[POST /guests]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
