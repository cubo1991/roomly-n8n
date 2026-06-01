import { prisma } from "@/lib/prisma";
import { createRoom, updateRoom, deleteRoom } from "../actions";
import SubmitButton from "@/components/dashboard/SubmitButton";
import DeleteButton from "@/components/dashboard/DeleteButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ROOM_STATUSES = [
  { value: "AVAILABLE", label: "Disponible" },
  { value: "OCCUPIED", label: "Ocupada" },
  { value: "MAINTENANCE", label: "Mantenimiento" },
  { value: "OUT_OF_ORDER", label: "Fuera de servicio" },
] as const;

const statusBadge: Record<string, string> = {
  AVAILABLE: "bg-green-900/50 text-green-300 border-green-700",
  OCCUPIED: "bg-red-900/50 text-red-300 border-red-700",
  MAINTENANCE: "bg-yellow-900/50 text-yellow-300 border-yellow-700",
  OUT_OF_ORDER: "bg-zinc-800 text-zinc-500 border-zinc-600",
};

export default async function HabitacionesConfigPage() {
  const hotel = await prisma.hotel.findFirst({ orderBy: { createdAt: "asc" } });

  const [rooms, roomTypes] = hotel
    ? await Promise.all([
        prisma.room.findMany({
          where: { hotelId: hotel.id },
          include: {
            type: { select: { name: true } },
            _count: {
              select: {
                reservations: { where: { status: { in: ["CONFIRMED", "CHECKED_IN"] } } },
              },
            },
          },
          orderBy: [{ floor: "asc" }, { number: "asc" }],
        }),
        prisma.roomType.findMany({
          where: { hotelId: hotel.id },
          orderBy: { name: "asc" },
        }),
      ])
    : [[], []];

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/dashboard/configuracion" className="hover:text-white transition-colors">
          Configuración
        </Link>
        <span>/</span>
        <span className="text-white">Habitaciones</span>
      </div>

      <h1 className="text-2xl font-bold -mt-4">Habitaciones</h1>

      {roomTypes.length === 0 && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-4 text-yellow-300 text-sm">
          Primero necesitás crear al menos un{" "}
          <Link href="/dashboard/configuracion/tipos" className="underline">
            tipo de habitación
          </Link>
          .
        </div>
      )}

      {/* Rooms list */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold">Habitaciones existentes</h2>
          <span className="text-zinc-500 text-sm">{rooms.length} en total</span>
        </div>

        {rooms.length === 0 ? (
          <div className="px-6 py-8 text-center text-zinc-500 text-sm">
            No hay habitaciones. Creá una abajo.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {rooms.map((room) => (
              <details key={room.id} className="group">
                <summary className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-zinc-800/50 transition-colors list-none">
                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-lg font-bold w-12 shrink-0">{room.number}</span>
                    <span className="text-zinc-400 text-sm">{room.type.name}</span>
                    {room.floor != null && (
                      <span className="text-zinc-600 text-xs">Piso {room.floor}</span>
                    )}
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${statusBadge[room.status] ?? statusBadge.AVAILABLE}`}
                  >
                    {ROOM_STATUSES.find((s) => s.value === room.status)?.label ?? room.status}
                  </span>
                  <span className="text-zinc-600 group-open:rotate-90 transition-transform text-lg ml-2">
                    ›
                  </span>
                </summary>

                <form
                  action={updateRoom.bind(null, room.id)}
                  className="px-6 pb-6 pt-2 space-y-4 bg-zinc-800/30"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Número</label>
                      <input
                        name="number"
                        defaultValue={room.number}
                        required
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Piso</label>
                      <input
                        name="floor"
                        type="number"
                        defaultValue={room.floor ?? ""}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Tipo</label>
                      <select
                        name="typeId"
                        defaultValue={room.typeId}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      >
                        {roomTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Estado</label>
                      <select
                        name="status"
                        defaultValue={room.status}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      >
                        {ROOM_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2 sm:col-span-4">
                      <label className="block text-xs text-zinc-400 mb-1">Notas</label>
                      <input
                        name="notes"
                        defaultValue={room.notes ?? ""}
                        placeholder="Observaciones internas"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <DeleteButton
                      action={deleteRoom.bind(null, room.id)}
                      confirmText={`¿Eliminar la habitación ${room.number}? Esta acción no se puede deshacer.`}
                      disabled={room._count.reservations > 0}
                      disabledReason="Tiene reservas activas"
                    />
                    <SubmitButton>Guardar</SubmitButton>
                  </div>
                </form>
              </details>
            ))}
          </div>
        )}
      </div>

      {/* Create form */}
      {hotel && roomTypes.length > 0 && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="font-semibold">Nueva habitación</h2>
          </div>
          <form action={createRoom} className="p-6 space-y-4">
            <input type="hidden" name="hotelId" value={hotel.id} />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Número *</label>
                <input
                  name="number"
                  required
                  placeholder="101"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Piso</label>
                <input
                  name="floor"
                  type="number"
                  placeholder="1"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Tipo *</label>
                <select
                  name="typeId"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Seleccioná un tipo</option>
                  {roomTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} (máx {t.maxGuests} personas)
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-4">
                <label className="block text-xs text-zinc-400 mb-1">Notas</label>
                <input
                  name="notes"
                  placeholder="Observaciones opcionales"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <SubmitButton>Agregar habitación</SubmitButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
