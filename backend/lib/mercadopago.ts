import { MercadoPagoConfig } from "mercadopago";

/**
 * Singleton del cliente de Mercado Pago.
 * Usa MP_ACCESS_TOKEN del entorno (sandbox o producción según el valor).
 */
if (!process.env.MP_ACCESS_TOKEN) {
  console.warn("[MercadoPago] MP_ACCESS_TOKEN no está definido — los pagos no funcionarán.");
}

export const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN ?? "",
});
