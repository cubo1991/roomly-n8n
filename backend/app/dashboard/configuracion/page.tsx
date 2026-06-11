import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { updateHotel } from "./actions";
import SubmitButton from "@/components/dashboard/SubmitButton";

export const dynamic = "force-dynamic";

export default async function ConfiguracionPage() {
  const hotel = await prisma.hotel.findFirst({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { rooms: true, roomTypes: true, ratePlans: true } },
    },
  });

  const updateHotelWithId = hotel
    ? updateHotel.bind(null, hotel.id)
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Configuración</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Administrá los datos del hotel, habitaciones y tarifas
        </p>
      </div>

      {/* Quick nav cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            href: "/dashboard/configuracion/tipos",
            label: "Tipos de habitación",
            count: hotel?._count.roomTypes ?? 0,
            description: "Categorías y capacidades",
          },
          {
            href: "/dashboard/configuracion/habitaciones",
            label: "Habitaciones",
            count: hotel?._count.rooms ?? 0,
            description: "Alta, baja y cambio de estado",
          },
          {
            href: "/dashboard/configuracion/tarifas",
            label: "Tarifas",
            count: hotel?._count.ratePlans ?? 0,
            description: "Precios y vigencias",
          },
        ].map(({ href, label, count, description }) => (
          <Link
            key={href}
            href={href}
            className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 hover:border-zinc-600 transition-colors group"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold group-hover:text-blue-400 transition-colors">
                  {label}
                </p>
                <p className="text-zinc-500 text-sm mt-0.5">{description}</p>
              </div>
              <span className="text-2xl font-bold text-zinc-400">{count}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Banner: Template de WhatsApp para notificación de pago ────────────── */}
      <div className="rounded-xl border-2 border-yellow-500/60 bg-yellow-950/30 p-5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 text-lg">⚠️</span>
          <h2 className="font-semibold text-yellow-300 text-sm uppercase tracking-wide">
            Pendiente: Template de WhatsApp para confirmación de pago
          </h2>
        </div>
        <p className="text-yellow-200/80 text-sm leading-relaxed">
          Cuando Mercado Pago confirma un pago, el sistema envía automáticamente un mensaje de WhatsApp
          al huésped. Si el pago ocurre <strong>dentro de las 24 h</strong> de la última interacción,
          el mensaje se envía sin template (ventana de conversación activa).
        </p>
        <p className="text-yellow-200/80 text-sm leading-relaxed">
          Si pasan más de 24 h, Meta requiere un <strong>template aprobado</strong> (mensaje proactivo).
          El proceso de aprobación se gestiona desde{" "}
          <span className="font-mono bg-yellow-900/50 px-1 rounded text-yellow-300">
            Meta Business Suite → WhatsApp → Plantillas de mensajes
          </span>.
        </p>
        <p className="text-green-400/90 text-sm font-medium">
          ✅ Para el MVP esto no es necesario — la mayoría de pagos ocurren dentro de las 24 h.
          Recordá implementarlo antes de pasar a producción con alto volumen.
        </p>
      </div>

      {/* Hotel info form */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="font-semibold">Datos del hotel</h2>
        </div>

        {hotel && updateHotelWithId ? (
          <form action={updateHotelWithId} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Nombre
                </label>
                <input
                  name="name"
                  defaultValue={hotel.name}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Teléfono
                </label>
                <input
                  name="phone"
                  defaultValue={hotel.phone ?? ""}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Email
                </label>
                <input
                  name="email"
                  type="email"
                  defaultValue={hotel.email ?? ""}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Dirección
                </label>
                <input
                  name="address"
                  defaultValue={hotel.address ?? ""}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <SubmitButton>Guardar cambios</SubmitButton>
            </div>
          </form>
        ) : (
          <div className="p-6 text-zinc-500 text-sm">
            No hay hotel configurado. Usá{" "}
            <code className="bg-zinc-800 px-1 rounded">
              POST /api/v1/hotels
            </code>{" "}
            para crear uno primero.
          </div>
        )}
      </div>
    </div>
  );
}
