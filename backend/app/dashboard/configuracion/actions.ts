"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  UpdateHotelSchema,
  CreateRoomTypeSchema,
  UpdateRoomTypeSchema,
  CreateRoomSchema,
  UpdateRoomSchema,
  CreateRatePlanSchema,
  UpdateRatePlanSchema,
} from "@/lib/validations";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Used only by DeleteButton (called imperatively, not via form action=). */
export type DeleteResult = { ok: true } | { ok: false; error: string };

// ─── Hotel ───────────────────────────────────────────────────────────────────

export async function updateHotel(id: string, data: FormData): Promise<void> {
  const parsed = UpdateHotelSchema.safeParse({
    name: data.get("name"),
    address: data.get("address") || undefined,
    phone: data.get("phone") || undefined,
    email: data.get("email") || undefined,
    timezone: data.get("timezone") || undefined,
  });

  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    throw new Error(first ?? "Datos inválidos");
  }

  await prisma.hotel.update({ where: { id }, data: parsed.data });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/configuracion");
}

// ─── Room Types ───────────────────────────────────────────────────────────────

export async function createRoomType(data: FormData): Promise<void> {
  const amenities = ((data.get("amenities") as string) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const parsed = CreateRoomTypeSchema.safeParse({
    hotelId: data.get("hotelId"),
    name: data.get("name"),
    description: data.get("description") || undefined,
    maxGuests: data.get("maxGuests"),
    amenities,
  });

  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    throw new Error(first ?? "Datos inválidos");
  }

  await prisma.roomType.create({ data: parsed.data });
  revalidatePath("/dashboard/configuracion/tipos");
}

export async function updateRoomType(id: string, data: FormData): Promise<void> {
  const amenities = ((data.get("amenities") as string) ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const parsed = UpdateRoomTypeSchema.safeParse({
    name: data.get("name") || undefined,
    description: data.get("description") || undefined,
    maxGuests: data.get("maxGuests") || undefined,
    amenities: amenities.length > 0 ? amenities : undefined,
  });

  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    throw new Error(first ?? "Datos inválidos");
  }

  await prisma.roomType.update({ where: { id }, data: parsed.data });
  revalidatePath("/dashboard/configuracion/tipos");
}

export async function deleteRoomType(id: string): Promise<DeleteResult> {
  const count = await prisma.room.count({ where: { typeId: id } });
  if (count > 0) {
    return {
      ok: false,
      error: `No se puede eliminar: tiene ${count} habitación${count > 1 ? "es" : ""} asignada${count > 1 ? "s" : ""}`,
    };
  }
  await prisma.roomType.delete({ where: { id } });
  revalidatePath("/dashboard/configuracion/tipos");
  return { ok: true };
}

// ─── Rooms ────────────────────────────────────────────────────────────────────

export async function createRoom(data: FormData): Promise<void> {
  const parsed = CreateRoomSchema.safeParse({
    hotelId: data.get("hotelId"),
    typeId: data.get("typeId"),
    number: data.get("number"),
    floor: data.get("floor") || undefined,
    notes: data.get("notes") || undefined,
  });

  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    throw new Error(first ?? "Datos inválidos");
  }

  try {
    await prisma.room.create({ data: parsed.data });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      throw new Error("Ya existe una habitación con ese número");
    }
    throw err;
  }

  revalidatePath("/dashboard/configuracion/habitaciones");
  revalidatePath("/dashboard/rooms");
}

export async function updateRoom(id: string, data: FormData): Promise<void> {
  const parsed = UpdateRoomSchema.safeParse({
    number: data.get("number") || undefined,
    floor: data.get("floor") || undefined,
    typeId: data.get("typeId") || undefined,
    status: data.get("status") || undefined,
    notes: data.get("notes") || undefined,
  });

  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    throw new Error(first ?? "Datos inválidos");
  }

  await prisma.room.update({ where: { id }, data: parsed.data });
  revalidatePath("/dashboard/configuracion/habitaciones");
  revalidatePath("/dashboard/rooms");
}

export async function deleteRoom(id: string): Promise<DeleteResult> {
  const count = await prisma.reservation.count({
    where: { roomId: id, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
  });
  if (count > 0) {
    return {
      ok: false,
      error: `No se puede eliminar: tiene ${count} reserva${count > 1 ? "s" : ""} activa${count > 1 ? "s" : ""}`,
    };
  }
  await prisma.room.delete({ where: { id } });
  revalidatePath("/dashboard/configuracion/habitaciones");
  revalidatePath("/dashboard/rooms");
  return { ok: true };
}

// ─── Rate Plans ───────────────────────────────────────────────────────────────

export async function createRatePlan(data: FormData): Promise<void> {
  const parsed = CreateRatePlanSchema.safeParse({
    hotelId: data.get("hotelId"),
    typeId: data.get("typeId"),
    name: data.get("name"),
    pricePerNight: data.get("pricePerNight"),
    validFrom: data.get("validFrom"),
    validTo: data.get("validTo"),
    minNights: data.get("minNights") || 1,
  });

  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    throw new Error(first ?? "Datos inválidos");
  }

  await prisma.ratePlan.create({
    data: {
      ...parsed.data,
      validFrom: new Date(parsed.data.validFrom),
      validTo: new Date(parsed.data.validTo),
    },
  });

  revalidatePath("/dashboard/configuracion/tarifas");
}

export async function updateRatePlan(id: string, data: FormData): Promise<void> {
  const parsed = UpdateRatePlanSchema.safeParse({
    name: data.get("name") || undefined,
    pricePerNight: data.get("pricePerNight") || undefined,
    validFrom: data.get("validFrom") || undefined,
    validTo: data.get("validTo") || undefined,
    minNights: data.get("minNights") || undefined,
  });

  if (!parsed.success) {
    const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
    throw new Error(first ?? "Datos inválidos");
  }

  const { validFrom, validTo, ...rest } = parsed.data;
  await prisma.ratePlan.update({
    where: { id },
    data: {
      ...rest,
      ...(validFrom ? { validFrom: new Date(validFrom) } : {}),
      ...(validTo ? { validTo: new Date(validTo) } : {}),
    },
  });

  revalidatePath("/dashboard/configuracion/tarifas");
}

export async function deleteRatePlan(id: string): Promise<DeleteResult> {
  const count = await prisma.reservation.count({
    where: { ratePlanId: id, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
  });
  if (count > 0) {
    return {
      ok: false,
      error: `No se puede eliminar: tiene ${count} reserva${count > 1 ? "s" : ""} activa${count > 1 ? "s" : ""}`,
    };
  }
  await prisma.ratePlan.delete({ where: { id } });
  revalidatePath("/dashboard/configuracion/tarifas");
  return { ok: true };
}
