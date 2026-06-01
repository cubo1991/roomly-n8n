"use client";

type RoomCell = {
  id: string;
  number: string;
  floor: number | null;
  typeName: string;
  status: string;
  reservation: {
    guest: { name: string; phone: string };
  } | null;
};

const statusStyle: Record<string, string> = {
  AVAILABLE: "bg-green-900/50 border-green-700 text-green-300",
  OCCUPIED: "bg-red-900/50 border-red-700 text-red-300",
  MAINTENANCE: "bg-yellow-900/50 border-yellow-700 text-yellow-300",
  OUT_OF_ORDER: "bg-zinc-800 border-zinc-600 text-zinc-500",
};

const statusLabel: Record<string, string> = {
  AVAILABLE: "Libre",
  OCCUPIED: "Ocupada",
  MAINTENANCE: "Mantenimiento",
  OUT_OF_ORDER: "Fuera de servicio",
};

export default function RoomGrid({ rooms }: { rooms: RoomCell[] }) {
  if (rooms.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500 text-sm">
        No hay habitaciones cargadas.
      </div>
    );
  }

  // Group by floor
  const floors = rooms.reduce<Record<string, RoomCell[]>>((acc, room) => {
    const floor = String(room.floor ?? "Sin piso");
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-8">
      {Object.entries(floors)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([floor, floorRooms]) => (
          <div key={floor}>
            <h3 className="text-sm text-zinc-500 font-medium mb-3 uppercase tracking-wide">
              {floor === "Sin piso" ? "Sin piso" : `Piso ${floor}`}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {floorRooms.map((room) => (
                <div
                  key={room.id}
                  className={`rounded-xl border p-3 ${statusStyle[room.status] ?? statusStyle.AVAILABLE}`}
                >
                  <div className="text-lg font-bold">{room.number}</div>
                  <div className="text-xs opacity-75">{room.typeName}</div>
                  <div className="text-xs font-medium mt-1">
                    {statusLabel[room.status] ?? room.status}
                  </div>
                  {room.reservation && (
                    <div className="text-xs mt-1 opacity-80 truncate">
                      {room.reservation.guest.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

      {/* Legend */}
      <div className="flex gap-4 text-xs text-zinc-500 pt-2 border-t border-zinc-800">
        {Object.entries(statusLabel).map(([key, label]) => (
          <div key={key} className="flex items-center gap-1.5">
            <div
              className={`w-2.5 h-2.5 rounded-sm border ${
                statusStyle[key]?.split(" ").slice(0, 2).join(" ") ?? ""
              }`}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
