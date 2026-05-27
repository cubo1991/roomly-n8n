import { z } from "zod";

// ─── Shared ───────────────────────────────────────────────────────────────────

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

// ─── Reservation ─────────────────────────────────────────────────────────────

export const CreateReservationSchema = z
  .object({
    hotelId: z.string().min(1),
    roomId: z.string().min(1),

    // Format A: nested guest object (dashboard / direct API)
    guest: z
      .object({
        name: z.string().min(2).max(100),
        phone: z.string().min(8).max(20),
        email: z.string().email().optional(),
        dni: z.string().optional(),
      })
      .optional(),

    // Format B: flat guest fields (n8n tool nodes send body as key-value pairs)
    guestName: z.string().min(2).max(100).optional(),
    guestPhone: z.string().min(8).max(20).optional(),
    guestEmail: z.string().email().optional(),

    checkIn: dateString,
    checkOut: dateString,
    // z.coerce: n8n sends numbers as strings when using bodyParameters
    numGuests: z.coerce.number().int().min(1).max(20).default(1),
    channel: z
      .enum(["WHATSAPP", "WEB", "PHONE", "OTA", "DIRECT"])
      .default("WHATSAPP"),
    ratePlanId: z.string().min(1).optional(),
    notes: z.string().max(500).optional(),
    // RML code: optional. If provided by n8n it's preserved; otherwise generated server-side.
    code: z
      .string()
      .regex(/^RML-\d{4}$/, "Code must be RML-XXXX format")
      .optional(),
  })
  .refine(
    (data) =>
      data.guest != null || (data.guestName != null && data.guestPhone != null),
    {
      message:
        "Provide either a 'guest' object or both 'guestName' + 'guestPhone' fields",
    }
  )
  .refine(
    (data) => new Date(data.checkOut) > new Date(data.checkIn),
    { message: "checkOut must be after checkIn", path: ["checkOut"] }
  );

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;

export const UpdateReservationSchema = z
  .object({
    checkIn: dateString.optional(),
    checkOut: dateString.optional(),
    numGuests: z.coerce.number().int().min(1).max(20).optional(),
    status: z
      .enum([
        "PENDING",
        "CONFIRMED",
        "CHECKED_IN",
        "CHECKED_OUT",
        "CANCELLED",
        "NO_SHOW",
      ])
      .optional(),
    notes: z.string().max(500).optional(),
    roomId: z.string().min(1).optional(),
  })
  // Strip empty strings that n8n may send for unfilled optional fields
  .transform((data) =>
    Object.fromEntries(
      Object.entries(data).filter(
        ([, v]) => v !== "" && v !== null && v !== undefined
      )
    ) as typeof data
  )
  .refine(
    (data) =>
      !data.checkIn ||
      !data.checkOut ||
      new Date(data.checkOut) > new Date(data.checkIn),
    { message: "checkOut must be after checkIn", path: ["checkOut"] }
  );

export type UpdateReservationInput = z.infer<typeof UpdateReservationSchema>;

// ─── Room ────────────────────────────────────────────────────────────────────

export const CreateRoomSchema = z.object({
  hotelId: z.string().min(1),
  typeId: z.string().min(1),
  number: z.string().min(1).max(10),
  floor: z.coerce.number().int().optional(),
  notes: z.string().optional(),
});

export type CreateRoomInput = z.infer<typeof CreateRoomSchema>;

// ─── Guest ───────────────────────────────────────────────────────────────────

export const CreateGuestSchema = z.object({
  hotelId: z.string().min(1),
  name: z.string().min(2).max(100),
  phone: z.string().min(8).max(20),
  email: z.string().email().optional(),
  dni: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateGuestInput = z.infer<typeof CreateGuestSchema>;

// ─── Hotel ───────────────────────────────────────────────────────────────────

export const UpdateHotelSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  timezone: z.string().optional(),
});

export type UpdateHotelInput = z.infer<typeof UpdateHotelSchema>;

// ─── Room (update) ────────────────────────────────────────────────────────────

export const UpdateRoomSchema = z.object({
  number: z.string().min(1).max(10).optional(),
  floor: z.coerce.number().int().optional(),
  typeId: z.string().min(1).optional(),
  status: z
    .enum(["AVAILABLE", "OCCUPIED", "MAINTENANCE", "OUT_OF_ORDER"])
    .optional(),
  notes: z.string().optional(),
});

export type UpdateRoomInput = z.infer<typeof UpdateRoomSchema>;

// ─── RoomType ─────────────────────────────────────────────────────────────────

export const CreateRoomTypeSchema = z.object({
  hotelId: z.string().min(1),
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  maxGuests: z.coerce.number().int().min(1).max(20).default(2),
  amenities: z.array(z.string()).default([]),
});

export type CreateRoomTypeInput = z.infer<typeof CreateRoomTypeSchema>;

export const UpdateRoomTypeSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  maxGuests: z.coerce.number().int().min(1).max(20).optional(),
  amenities: z.array(z.string()).optional(),
});

export type UpdateRoomTypeInput = z.infer<typeof UpdateRoomTypeSchema>;

// ─── RatePlan ─────────────────────────────────────────────────────────────────

export const CreateRatePlanSchema = z
  .object({
    hotelId: z.string().min(1),
    typeId: z.string().min(1),
    name: z.string().min(2).max(100),
    pricePerNight: z.coerce.number().positive(),
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    minNights: z.coerce.number().int().min(1).default(1),
  })
  .refine((d) => new Date(d.validTo) > new Date(d.validFrom), {
    message: "validTo must be after validFrom",
    path: ["validTo"],
  });

export type CreateRatePlanInput = z.infer<typeof CreateRatePlanSchema>;

export const UpdateRatePlanSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    pricePerNight: z.coerce.number().positive().optional(),
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    minNights: z.coerce.number().int().min(1).optional(),
  })
  .refine(
    (d) =>
      !d.validFrom || !d.validTo || new Date(d.validTo) > new Date(d.validFrom),
    { message: "validTo must be after validFrom", path: ["validTo"] }
  );

export type UpdateRatePlanInput = z.infer<typeof UpdateRatePlanSchema>;

// ─── Auth ────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginInput = z.infer<typeof LoginSchema>;
