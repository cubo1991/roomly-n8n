import { z } from "zod";

// ─── Shared ───────────────────────────────────────────────────────────────────

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

// ─── Reservation ─────────────────────────────────────────────────────────────

export const CreateReservationSchema = z.object({
  hotelId: z.string().cuid(),
  roomId: z.string().cuid(),
  guest: z.object({
    name: z.string().min(2).max(100),
    phone: z.string().min(8).max(20), // WhatsApp number
    email: z.string().email().optional(),
    dni: z.string().optional(),
  }),
  checkIn: dateString,
  checkOut: dateString,
  numGuests: z.number().int().min(1).max(20).default(1),
  channel: z.enum(["WHATSAPP", "WEB", "PHONE", "OTA", "DIRECT"]).default("WHATSAPP"),
  ratePlanId: z.string().cuid().optional(),
  notes: z.string().max(500).optional(),
  // If provided by n8n (already generated), preserve it. Otherwise generated server-side.
  code: z
    .string()
    .regex(/^RML-\d{4}$/, "Code must be RML-XXXX format")
    .optional(),
}).refine(
  (data) => new Date(data.checkOut) > new Date(data.checkIn),
  { message: "checkOut must be after checkIn", path: ["checkOut"] }
);

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const UpdateReservationSchema = z.object({
  checkIn: dateString.optional(),
  checkOut: dateString.optional(),
  numGuests: z.number().int().min(1).max(20).optional(),
  status: z
    .enum(["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"])
    .optional(),
  notes: z.string().max(500).optional(),
  roomId: z.string().cuid().optional(),
}).refine(
  (data) =>
    !data.checkIn || !data.checkOut || new Date(data.checkOut) > new Date(data.checkIn),
  { message: "checkOut must be after checkIn", path: ["checkOut"] }
);

export type UpdateReservationInput = z.infer<typeof UpdateReservationSchema>;

// ─── Room ────────────────────────────────────────────────────────────────────

export const CreateRoomSchema = z.object({
  hotelId: z.string().cuid(),
  typeId: z.string().cuid(),
  number: z.string().min(1).max(10),
  floor: z.number().int().optional(),
  notes: z.string().optional(),
});

export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;

// ─── Guest ───────────────────────────────────────────────────────────────────

export const CreateGuestSchema = z.object({
  hotelId: z.string().cuid(),
  name: z.string().min(2).max(100),
  phone: z.string().min(8).max(20),
  email: z.string().email().optional(),
  dni: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateGuestInput = z.infer<typeof CreateGuestSchema>;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginInput = z.infer<typeof LoginSchema>;
