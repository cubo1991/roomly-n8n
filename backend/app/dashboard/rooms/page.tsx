import { prisma } from "@/lib/prisma";
import RoomGrid from "@/components/dashboard/RoomGrid";
import { getRoomStatusGrid } from "@/services/availability.service";

export const dynamic = "force-dynamic";

export default async function RoomsPage() {
  const hotel = await prisma.hotel.findFirst({ orderBy: { createdAt: "asc" } });

  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  // Ventana de HOY: una habitación está "ocupada" solo si hay alguien
  // hospedado esta noche (check-in ≤ hoy < check-out).
  const grid = hotel ? await getRoomStatusGrid(hotel.id, today, tomorrow) : [];

  const available = grid.filter((r) => r.status === "AVAILABLE").length;
  const occupied = grid.filter((r) => r.status === "OCCUPIED").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Habitaciones</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Estado actual · hoy ({today})
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Disponibles", value: available, color: "text-green-400" },
          { label: "Ocupadas", value: occupied, color: "text-red-400" },
          { label: "Total", value: grid.length, color: "text-zinc-300" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <p className="text-zinc-400 text-sm">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="font-semibold">Grilla de habitaciones</h2>
        </div>
        <RoomGrid rooms={grid} />
      </div>
    </div>
  );
}
