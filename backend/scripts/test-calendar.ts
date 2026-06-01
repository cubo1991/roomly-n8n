/**
 * Script de prueba de integración con Google Calendar.
 * Ejecutar con: npx tsx scripts/test-calendar.ts
 *
 * Intenta crear, luego eliminar un evento de prueba.
 * Muestra el error exacto si algo falla.
 */

import "dotenv/config";
import { google } from "googleapis";

async function main() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key   = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const calId = process.env.GOOGLE_CALENDAR_ID;

  console.log("─── Configuración ────────────────────────────────");
  console.log("Service Account:", email ?? "(vacío ❌)");
  console.log("Calendar ID:    ", calId  ?? "(vacío ❌)");
  console.log("Private Key:    ", key ? `${key.slice(0, 40)}… ✅` : "(vacío ❌)");
  console.log("");

  if (!email || !key || !calId) {
    console.error("❌ Faltan variables de entorno. Revisá backend/.env");
    process.exit(1);
  }

  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });

  const cal = google.calendar({ version: "v3", auth });

  // ── 1. Crear evento de prueba ──────────────────────────────
  console.log("─── Paso 1: Crear evento de prueba ───────────────");
  let eventId: string | null = null;
  try {
    const { data } = await cal.events.insert({
      calendarId: calId,
      requestBody: {
        summary: "[TEST] Roomly – prueba de integración",
        description: "Este evento fue creado automáticamente por el script test-calendar.ts y puede eliminarse.",
        start: { date: "2026-06-01" },
        end:   { date: "2026-06-03" },
        colorId: "2",
      },
    });
    eventId = data.id ?? null;
    console.log("✅ Evento creado correctamente");
    console.log("   ID:", eventId);
    console.log("   Link:", data.htmlLink);
  } catch (err: unknown) {
    console.error("❌ Error al crear evento:");
    if (err && typeof err === "object" && "response" in err) {
      const e = err as { response?: { status?: number; data?: unknown } };
      console.error("   Status:", e.response?.status);
      console.error("   Detalle:", JSON.stringify(e.response?.data, null, 2));
    } else {
      console.error("  ", err);
    }
    console.log("");
    console.log("💡 Si el error es 403 → la service account no tiene permiso en el calendario.");
    console.log(`   Compartí el calendario con: ${email}`);
    console.log("   Permiso requerido: 'Realizar cambios en eventos'");
    process.exit(1);
  }

  // ── 2. Eliminar el evento de prueba ───────────────────────
  console.log("");
  console.log("─── Paso 2: Eliminar evento de prueba ────────────");
  if (eventId) {
    try {
      await cal.events.delete({ calendarId: calId, eventId });
      console.log("✅ Evento eliminado correctamente");
    } catch (err) {
      console.warn("⚠️  No se pudo eliminar el evento de prueba. Borralo manualmente desde Google Calendar.");
      console.warn("   ID:", eventId);
    }
  }

  console.log("");
  console.log("═══════════════════════════════════════════════════");
  console.log("✅ Integración con Google Calendar funcionando OK");
  console.log("═══════════════════════════════════════════════════");
}

main();
