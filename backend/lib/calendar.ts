import { google } from "googleapis";

// ─── Auth ──────────────────────────────────────────────────────────────────────

function getCalendarClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key   = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!email || !key) return null; // Calendar disabled – credentials not configured

  const auth = new google.auth.JWT({
    email,
    key: key.replace(/\\n/g, "\n"), // support \\n escaped newlines in .env
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });

  return google.calendar({ version: "v3", auth });
}

const CALENDAR_ID = () => process.env.GOOGLE_CALENDAR_ID ?? "primary";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toDateString(d: Date | string): string {
  const iso = typeof d === "string" ? d : d.toISOString();
  return iso.split("T")[0]; // → "YYYY-MM-DD"
}

// ─── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Creates an all-day Calendar event for a reservation.
 * Returns the Google Calendar event ID, or null if Calendar is disabled / call fails.
 */
export async function createCalendarEvent(params: {
  code:      string; // RML-XXXX
  guestName: string;
  roomNumber: string;
  checkIn:   Date | string;
  checkOut:  Date | string;
  numGuests: number;
}): Promise<string | null> {
  const cal = getCalendarClient();
  if (!cal) return null;

  try {
    const { data } = await cal.events.insert({
      calendarId: CALENDAR_ID(),
      requestBody: {
        summary: `[${params.code}] Hab. ${params.roomNumber} – ${params.guestName}`,
        description:
          `Reserva: ${params.code}\n` +
          `Huésped: ${params.guestName}\n` +
          `Hab.: ${params.roomNumber} · ${params.numGuests} persona(s)`,
        start: { date: toDateString(params.checkIn) },
        // Google Calendar end date is exclusive for all-day events
        end:   { date: toDateString(params.checkOut) },
        colorId: "2", // sage green
      },
    });
    return data.id ?? null;
  } catch (err) {
    console.error("[Calendar] createCalendarEvent:", err);
    return null;
  }
}

/**
 * Updates an existing Calendar event (dates and/or guest count).
 * Silently no-ops if Calendar is disabled or eventId is missing.
 */
export async function updateCalendarEvent(
  eventId: string,
  params: {
    guestName?:  string;
    roomNumber?: string;
    checkIn?:    Date | string;
    checkOut?:   Date | string;
    numGuests?:  number;
    code?:       string;
  }
): Promise<void> {
  const cal = getCalendarClient();
  if (!cal || !eventId) return;

  try {
    const patch: Record<string, unknown> = {};
    if (params.checkIn)  patch.start = { date: toDateString(params.checkIn) };
    if (params.checkOut) patch.end   = { date: toDateString(params.checkOut) };
    if (params.guestName || params.roomNumber || params.code) {
      patch.summary =
        `[${params.code ?? "RML"}] Hab. ${params.roomNumber ?? "?"} – ${params.guestName ?? "?"}`;
    }
    if (params.numGuests !== undefined) {
      patch.description =
        `Reserva: ${params.code ?? ""}\n` +
        `Huésped: ${params.guestName ?? ""}\n` +
        `Hab.: ${params.roomNumber ?? "?"} · ${params.numGuests} persona(s)`;
    }
    if (Object.keys(patch).length === 0) return;

    await cal.events.patch({
      calendarId: CALENDAR_ID(),
      eventId,
      requestBody: patch,
    });
  } catch (err) {
    console.error("[Calendar] updateCalendarEvent:", err);
  }
}

/**
 * Deletes a Calendar event (e.g. when reservation is cancelled).
 * Silently no-ops if Calendar is disabled or eventId is missing.
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const cal = getCalendarClient();
  if (!cal || !eventId) return;

  try {
    await cal.events.delete({
      calendarId: CALENDAR_ID(),
      eventId,
    });
  } catch (err) {
    console.error("[Calendar] deleteCalendarEvent:", err);
  }
}
