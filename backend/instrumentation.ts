export async function register() {
  // Solo en el runtime de Node.js (no en Edge ni en el cliente)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startReservationWorker } = await import("@/lib/queue");
    startReservationWorker();
    console.log("[Instrumentation] BullMQ worker iniciado");
  }
}
