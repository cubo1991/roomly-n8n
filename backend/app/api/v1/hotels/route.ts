import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateHotelSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  timezone: z.string().default("America/Argentina/Buenos_Aires"),
});

export async function GET() {
  try {
    const hotels = await prisma.hotel.findMany({
      include: {
        _count: {
          select: {
            rooms: true,
            reservations: true,
            guests: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(hotels);
  } catch (err) {
    console.error("[GET /hotels]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateHotelSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const hotel = await prisma.hotel.create({ data: parsed.data });
    return NextResponse.json(hotel, { status: 201 });
  } catch (err) {
    console.error("[POST /hotels]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
