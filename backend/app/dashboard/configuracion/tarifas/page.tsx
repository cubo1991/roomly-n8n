import { prisma } from "@/lib/prisma";
import { createRatePlan, updateRatePlan, deleteRatePlan } from "../actions";
import SubmitButton from "@/components/dashboard/SubmitButton";
import DeleteButton from "@/components/dashboard/DeleteButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return d.toISOString().split("T")[0];
}

function formatPrice(p: { toNumber(): number } | number) {
  const n = typeof p === "number" ? p : p.toNumber();
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function TarifasPage() {
  const hotel = await prisma.hotel.findFirst({ orderBy: { createdAt: "asc" } });

  const [ratePlans, roomTypes] = hotel
    ? await Promise.all([
        prisma.ratePlan.findMany({
          where: { hotelId: hotel.id },
          include: {
            type: { select: { name: true } },
            _count: {
              select: {
                reservations: { where: { status: { in: ["CONFIRMED", "CHECKED_IN"] } } },
              },
            },
          },
          orderBy: [{ typeId: "asc" }, { validFrom: "asc" }],
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
        <span className="text-white">Tarifas</span>
      </div>

      <h1 className="text-2xl font-bold -mt-4">Planes de tarifa</h1>

      {roomTypes.length === 0 && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-4 text-yellow-300 text-sm">
          Primero necesitás crear{" "}
          <Link href="/dashboard/configuracion/tipos" className="underline">
            tipos de habitación
          </Link>{" "}
          para poder asignar tarifas.
        </div>
      )}

      {/* Plans list */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold">Tarifas existentes</h2>
          <span className="text-zinc-500 text-sm">{ratePlans.length} en total</span>
        </div>

        {ratePlans.length === 0 ? (
          <div className="px-6 py-8 text-center text-zinc-500 text-sm">
            No hay tarifas cargadas. Creá una abajo.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {ratePlans.map((plan) => (
              <details key={plan.id} className="group">
                <summary className="flex items-center gap-4 px-6 py-4 cursor-pointer hover:bg-zinc-800/50 transition-colors list-none">
                  <div className="flex-1">
                    <span className="font-medium">{plan.name}</span>
                    <div className="text-xs text-zinc-500 mt-0.5">
                      {plan.type.name} · {formatDate(plan.validFrom)} → {formatDate(plan.validTo)}
                      {plan.minNights > 1 && ` · mín ${plan.minNights} noches`}
                    </div>
                  </div>
                  <span className="text-blue-400 font-semibold">
                    {formatPrice(plan.pricePerNight)}/noche
                  </span>
                  <span className="text-zinc-600 group-open:rotate-90 transition-transform text-lg ml-2">›</span>
                </summary>

                <form
                  action={updateRatePlan.bind(null, plan.id)}
                  className="px-6 pb-6 pt-2 space-y-4 bg-zinc-800/30"
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-xs text-zinc-400 mb-1">Nombre del plan</label>
                      <input
                        name="name"
                        defaultValue={plan.name}
                        required
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Precio/noche (ARS)</label>
                      <input
                        name="pricePerNight"
                        type="number"
                        min={0}
                        step={0.01}
                        defaultValue={plan.pricePerNight.toNumber()}
                        required
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Mín. noches</label>
                      <input
                        name="minNights"
                        type="number"
                        min={1}
                        defaultValue={plan.minNights}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Vigencia desde</label>
                      <input
                        name="validFrom"
                        type="date"
                        defaultValue={formatDate(plan.validFrom)}
                        required
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Vigencia hasta</label>
                      <input
                        name="validTo"
                        type="date"
                        defaultValue={formatDate(plan.validTo)}
                        required
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <DeleteButton
                      action={deleteRatePlan.bind(null, plan.id)}
                      confirmText={`¿Eliminar la tarifa "${plan.name}"? Esta acción no se puede deshacer.`}
                      disabled={plan._count.reservations > 0}
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
            <h2 className="font-semibold">Nueva tarifa</h2>
          </div>
          <form action={createRatePlan} className="p-6 space-y-4">
            <input type="hidden" name="hotelId" value={hotel.id} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs text-zinc-400 mb-1">Nombre del plan *</label>
                <input
                  name="name"
                  required
                  placeholder="Ej: Temporada alta"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-zinc-400 mb-1">Tipo de habitación *</label>
                <select
                  name="typeId"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="">Seleccioná un tipo</option>
                  {roomTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Precio/noche (ARS) *</label>
                <input
                  name="pricePerNight"
                  type="number"
                  min={0}
                  step={0.01}
                  required
                  placeholder="15000"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Mín. noches</label>
                <input
                  name="minNights"
                  type="number"
                  min={1}
                  defaultValue={1}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Vigencia desde *</label>
                <input
                  name="validFrom"
                  type="date"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Vigencia hasta *</label>
                <input
                  name="validTo"
                  type="date"
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <SubmitButton>Crear tarifa</SubmitButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
