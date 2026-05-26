import { NextRequest, NextResponse } from "next/server";
import { cancelReservation } from "@/services/reservation.service";

/**
 * GET /api/v1/reservations/cancelar?id=xxx
 * Flat query-param version for n8n AI tools (avoids $fromAI in URL path).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const cancelled = await cancelReservation(id);
    return NextResponse.json(cancelled);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[GET /reservations/cancelar]", err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
