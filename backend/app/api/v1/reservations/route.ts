import { NextRequest, NextResponse } from "next/server";
import { CreateReservationSchema } from "@/lib/validations";
import {
  createReservation,
  listReservations,
} from "@/services/reservation.service";

/**
 * GET /api/v1/reservations
 * Query params: hotelId, status, from (YYYY-MM-DD), to (YYYY-MM-DD), page, pageSize
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const hotelId = searchParams.get("hotelId");

    if (!hotelId) {
      return NextResponse.json(
        { error: "hotelId is required" },
        { status: 400 }
      );
    }

    const result = await listReservations(hotelId, {
      status: searchParams.get("status") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined,
      page: Number(searchParams.get("page") ?? 1),
      pageSize: Number(searchParams.get("pageSize") ?? 20),
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /reservations]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/v1/reservations
 * Body: CreateReservationSchema
 *
 * Called by n8n after a WhatsApp conversation completes.
 * Requires X-N8N-Secret header (validated in middleware.ts).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateReservationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const reservation = await createReservation(parsed.data);

    return NextResponse.json(reservation, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status = message.includes("not available") ? 409 : 500;
    console.error("[POST /reservations]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
