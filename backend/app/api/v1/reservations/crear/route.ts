import { NextRequest, NextResponse } from "next/server";
import { CreateReservationSchema } from "@/lib/validations";
import { createReservation } from "@/services/reservation.service";

/**
 * GET /api/v1/reservations/crear
 * Versión GET de crear reserva para compatibilidad con n8n + Gemini.
 * Query params: hotelId, roomId, guestName, guestPhone, checkIn, checkOut, numGuests, channel, code
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const body = {
      hotelId:   searchParams.get("hotelId"),
      roomId:    searchParams.get("roomId"),
      guestName: searchParams.get("guestName"),
      guestPhone: req.headers.get("x-guest-phone") ?? searchParams.get("guestPhone"),
      checkIn:   searchParams.get("checkIn"),
      checkOut:  searchParams.get("checkOut"),
      numGuests: searchParams.get("numGuests"),
      channel:   searchParams.get("channel") ?? "WHATSAPP",
      code:      req.headers.get("x-reservation-code") ?? searchParams.get("code") ?? undefined,
    };

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
    console.error("[GET /reservations/crear]", err);
    return NextResponse.json({ error: message }, { status });
  }
}
