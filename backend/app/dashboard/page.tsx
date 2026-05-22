import { prisma } from "@/lib/prisma";
import ReservationTable from "@/components/dashboard/ReservationTable";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // For MVP: use the first hotel found (single-tenant)
  const hotel = await prisma.hotel.findFirst({ orderBy: { createdAt: "asc" } });

  const reservations = hotel
    ? await prisma.reservation.findMany({
        where: { hotelId: hotel.id },
        include: {
          room: { select: { number: true } },
          guest: { select: { name: true, phone: true } },
        },
        orderBy: { checkIn: "asc" },
        take: 100,
      })
    : [];

  // Stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const checkinsToday = reservations.filter(
    (r) =>
      r.status === "CONFIRMED" &&
      r.checkIn >= today &&
      r.checkIn < tomorrow
  ).length;

  const active = reservations.filter(
    (r) => r.status === "CHECKED_IN"
  ).length;

  const confirmed = reservations.filter(
    (r) => r.status === "CONFIRMED"
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">
          {hotel ? hotel.name : "Sin hotel configurado"}
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Panel de reservas · {new Date().toLocaleDateString("es-AR", { dateStyle: "full" })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Check-ins hoy", value: checkinsToday, color: "text-blue-400" },
          { label: "Huéspedes activos", value: active, color: "text-green-400" },
          { label: "Confirmadas (próximas)", value: confirmed, color: "text-yellow-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
            <p className="text-zinc-400 text-sm">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Reservation table */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800">
          <h2 className="font-semibold">Reservas</h2>
        </div>
        <ReservationTable reservations={reservations} />
      </div>

      {!hotel && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-6 text-yellow-300 text-sm">
          No hay ningún hotel creado. Usá <code className="bg-zinc-800 px-1 rounded">POST /api/v1/hotels</code> para crear uno.
        </div>
      )}
    </div>
  );
}
