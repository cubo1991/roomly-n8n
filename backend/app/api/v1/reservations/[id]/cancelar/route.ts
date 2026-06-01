import { NextRequest, NextResponse } from "next/server";
import { cancelReservation } from "@/services/reservation.service";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/reservations/:id/cancelar
 * Versión GET de cancelar reserva para compatibilidad con n8n + Gemini.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const cancelled = await cancelReservation(id);
    return NextResponse.json(cancelled);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /reservations/:id/cancelar]", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
