import { NextRequest, NextResponse } from "next/server";
import { handleMPWebhook } from "@/services/payment.service";

/**
 * POST /api/v1/payments/webhook
 * Recibe notificaciones IPN de Mercado Pago.
 *
 * MP exige una respuesta 200 inmediata — el procesamiento real
 * se hace async para no bloquear la respuesta.
 *
 * Ruta EXCLUIDA del middleware de autenticación (ver middleware.ts).
 */
export async function POST(req: NextRequest) {
  // Responder 200 inmediatamente (requisito de MP)
  const body = await req.json().catch(() => null);

  const topic     = body?.type     ?? req.nextUrl.searchParams.get("topic");
  const paymentId = body?.data?.id ?? req.nextUrl.searchParams.get("id");

  if (topic === "payment" && paymentId) {
    // Fire-and-forget: no bloquea la respuesta 200
    handleMPWebhook(String(paymentId)).catch((err) => {
      console.error("[POST /payments/webhook] Error procesando pago:", err);
    });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
