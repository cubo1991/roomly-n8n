import { prisma } from "@/lib/prisma";
import { createRoomType, updateRoomType, deleteRoomType } from "../actions";
import SubmitButton from "@/components/dashboard/SubmitButton";
import Link from "next/link";
import DeleteButton from "@/components/dashboard/DeleteButton";

export const dynamic = "force-dynamic";

export default async function TiposPage() {
  const hotel = await prisma.hotel.findFirst({ orderBy: { createdAt: "asc" } });

  const types = hotel
    ? await prisma.roomType.findMany({
        where: { hotelId: hotel.id },
        include: { _count: { select: { rooms: true, ratePlans: true } } },
        orderBy: { name: "asc" },
      })
    : [];

  const createWithHotel = hotel
    ? createRoomType.bind(null) // hotelId va en el hidden input
    : null;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/dashboard/configuracion" className="hover:text-white transition-colors">
          Configuración
        </Link>
        <span>/</span>
        <span className="text-white">Tipos de habitación</span>
      </div>

      <h1 className="text-2xl font-bold -mt-4">Tipos de habitación</h1>

      {/* Current types */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="font-semibold">Tipos existentes</h2>
        </div>

        {types.length === 0 ? (
          <div className="px-6 py-8 text-center text-zinc-500 text-sm">
            No hay tipos de habitación. Creá uno abajo.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {types.map((type) => (
              <details key={type.id} className="group">
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-zinc-800/50 transition-colors list-none">
                  <div>
                    <span className="font-medium">{type.name}</span>
                    {type.description && (
                      <span className="text-zinc-500 text-sm ml-2">
                        · {type.description}
                      </span>
                    )}
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {type.maxGuests} huéspedes máx · {type._count.rooms} hab ·{" "}
                      {type._count.ratePlans} tarifa{type._count.ratePlans !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <span className="text-zinc-600 group-open:rotate-90 transition-transform text-lg">›</span>
                </summary>

                {/* Edit form (inline) */}
                <form
                  action={updateRoomType.bind(null, type.id)}
                  className="px-6 pb-6 pt-2 space-y-4 bg-zinc-800/30"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Nombre</label>
                      <input
                        name="name"
                        defaultValue={type.name}
                        required
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">
                        Capacidad máx (personas)
                      </label>
                      <input
                        name="maxGuests"
                        type="number"
                        min={1}
                        max={20}
                        defaultValue={type.maxGuests}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-zinc-400 mb-1">Descripción</label>
                      <input
                        name="description"
                        defaultValue={type.description ?? ""}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-zinc-400 mb-1">
                        Amenities{" "}
                        <span className="text-zinc-600">(separados por coma)</span>
                      </label>
                      <input
                        name="amenities"
                        defaultValue={type.amenities.join(", ")}
                        placeholder="WiFi, TV, Aire acondicionado"
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 justify-between">
                    <DeleteButton
                      action={deleteRoomType.bind(null, type.id)}
                      confirmText={`¿Eliminar el tipo "${type.name}"? Esta acción no se puede deshacer.`}
                      disabled={type._count.rooms > 0}
                      disabledReason="Tiene habitaciones asignadas"
                    />
                    <SubmitButton>Guardar cambios</SubmitButton>
                  </div>
                </form>
              </details>
            ))}
          </div>
        )}
      </div>

      {/* Create form */}
      {hotel && createWithHotel && (
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="font-semibold">Nuevo tipo de habitación</h2>
          </div>
          <form action={createRoomType} className="p-6 space-y-4">
            <input type="hidden" name="hotelId" value={hotel.id} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Nombre *</label>
                <input
                  name="name"
                  required
                  placeholder="Ej: Suite, Standard, Doble"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">
                  Capacidad máx (personas)
                </label>
                <input
                  name="maxGuests"
                  type="number"
                  min={1}
                  max={20}
                  defaultValue={2}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Descripción</label>
                <input
                  name="description"
                  placeholder="Descripción opcional"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">
                  Amenities{" "}
                  <span className="text-zinc-600">(separados por coma)</span>
                </label>
                <input
                  name="amenities"
                  placeholder="WiFi, TV, Aire acondicionado"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <SubmitButton>Crear tipo</SubmitButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
