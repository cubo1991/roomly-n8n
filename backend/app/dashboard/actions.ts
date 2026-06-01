"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ─── Guest ────────────────────────────────────────────────────────────────────

const UpdateGuestSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().or(z.literal("")),
  dni: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
});

/**
 * Update a guest's personal data from the dashboard.
 * Phone is intentionally excluded — it's the WhatsApp identifier and
 * changing it would break conversation continuity.
 */
export async function updateGuest(
  guestId: string,
  data: FormData
): Promise<void> {
  const raw = {
    name: (data.get("name") as string)?.trim() || undefined,
    email: (data.get("email") as string)?.trim() || undefined,
    dni: (data.get("dni") as string)?.trim() || undefined,
    notes: (data.get("notes") as string)?.trim() || undefined,
  };

  const parsed = UpdateGuestSchema.safeParse(raw);
  if (!parsed.success) {
    const flat = parsed.error.flatten();
    for (const [field, msgs] of Object.entries(flat.fieldErrors)) {
      if (msgs && msgs.length > 0) throw new Error(`${field}: ${msgs[0]}`);
    }
    throw new Error("Datos inválidos");
  }

  // Normalize empty email to undefined so it doesn't overwrite with ""
  const { email, ...rest } = parsed.data;
  await prisma.guest.update({
    where: { id: guestId },
    data: {
      ...rest,
      ...(email && email !== "" ? { email } : {}),
    },
  });

  revalidatePath("/dashboard");
}
