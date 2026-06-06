"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  getReservationChat as fetchReservationChat,
  type ChatMessage,
} from "@/services/conversation.service";

// ─── Guest ────────────────────────────────────────────────────────────────────

const UpdateGuestSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().or(z.literal("")),
  dni: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
});

/**
 * Update a reservation's holder name (its own titular) plus the contact's
 * email/DNI. The name is stored per-reservation (Reservation.guestName), so
 * editing it here does NOT affect other reservations of the same phone.
 * Email/DNI belong to the Guest (the WhatsApp contact, shared by phone).
 */
export async function updateReservationGuest(
  reservationId: string,
  guestId: string,
  data: FormData
): Promise<void> {
  const raw = {
    name: (data.get("name") as string)?.trim() || undefined,
    email: (data.get("email") as string)?.trim() || undefined,
    dni: (data.get("dni") as string)?.trim() || undefined,
  };

  const parsed = UpdateGuestSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    for (const [field, msgs] of Object.entries(flat.fieldErrors)) {
      if (msgs && msgs.length > 0) throw new Error(`${field}: ${msgs[0]}`);
    }
    throw new Error("Datos inválidos");
  }

  const { name, email, dni } = parsed.data;

  // Holder name lives on the reservation
  if (name) {
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { guestName: name },
    });
  }

  // Contact data (email/DNI) lives on the shared Guest
  await prisma.guest.update({
    where: { id: guestId },
    data: {
      ...(dni ? { dni } : {}),
      ...(email && email !== "" ? { email } : {}),
    },
  });

  revalidatePath("/dashboard");
}

// ─── Conversation ──────────────────────────────────────────────────────────────

/** Returns the chat transcript slice for a reservation (see conversation.service). */
export async function getReservationChat(
  reservationId: string
): Promise<ChatMessage[]> {
  return fetchReservationChat(reservationId);
}
