"use client";

import { Fragment, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import EditableGuestCell from "@/components/dashboard/EditableGuestCell";
import ChatDrawer from "@/components/dashboard/ChatDrawer";

type Reservation = {
  id: string;
  code: string;
  status: string;
  channel: string;
  checkIn: Date;
  checkOut: Date;
  numGuests: number;
  guestName: string | null;
  createdAt: Date;
  room: { number: string };
  guest: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
    dni?: string | null;
  };
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  CONFIRMED: { label: "Confirmada", variant: "default" },
  CHECKED_IN: { label: "Hospedado", variant: "secondary" },
  CHECKED_OUT: { label: "Salida", variant: "outline" },
  CANCELLED: { label: "Cancelada", variant: "destructive" },
  PENDING: { label: "Pendiente", variant: "outline" },
  NO_SHOW: { label: "No presentó", variant: "destructive" },
};

function formatDate(d: Date) {
  // Dates come from Prisma as midnight UTC (e.g. 2026-05-27T00:00:00.000Z).
  // Without timeZone: "UTC", the browser (UTC-3) would render "26/05/2026".
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateTime(d: Date) {
  // createdAt is a real instant (not a @db.Date), so show it in local time.
  return new Date(d).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function nightsBetween(a: Date, b: Date) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

const COLSPAN = 6;

export default function ReservationTable({
  reservations,
}: {
  reservations: Reservation[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [chat, setChat] = useState<{ id: string; title: string } | null>(null);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (reservations.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500 text-sm">
        No hay reservas registradas.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow className="border-zinc-800 hover:bg-transparent">
            <TableHead className="text-zinc-400">Código</TableHead>
            <TableHead className="text-zinc-400">Huésped</TableHead>
            <TableHead className="text-zinc-400">Hab.</TableHead>
            <TableHead className="text-zinc-400">Check-in</TableHead>
            <TableHead className="text-zinc-400">Check-out</TableHead>
            <TableHead className="text-zinc-400">Estado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reservations.map((r) => {
            const { label, variant } = statusConfig[r.status] ?? {
              label: r.status,
              variant: "outline" as const,
            };
            const isOpen = expanded.has(r.id);
            return (
              <Fragment key={r.id}>
                <TableRow
                  onClick={() => toggle(r.id)}
                  className="border-zinc-800 hover:bg-zinc-800/50 cursor-pointer"
                >
                  <TableCell className="font-mono text-blue-400">
                    <span className="inline-flex items-center gap-2">
                      <span className="text-zinc-500 text-xs w-3 inline-block">
                        {isOpen ? "▾" : "▸"}
                      </span>
                      {r.code}
                    </span>
                  </TableCell>
                  <TableCell
                    className="align-top py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EditableGuestCell
                      reservationId={r.id}
                      guestId={r.guest.id}
                      name={r.guestName ?? r.guest.name}
                      phone={r.guest.phone}
                      email={r.guest.email}
                      dni={r.guest.dni}
                    />
                  </TableCell>
                  <TableCell>{r.room.number}</TableCell>
                  <TableCell>{formatDate(r.checkIn)}</TableCell>
                  <TableCell>{formatDate(r.checkOut)}</TableCell>
                  <TableCell>
                    <Badge variant={variant}>{label}</Badge>
                  </TableCell>
                </TableRow>

                {isOpen && (
                  <TableRow
                    className="border-zinc-800 bg-zinc-950/40 hover:bg-zinc-950/40"
                  >
                    <TableCell colSpan={COLSPAN} className="py-4">
                      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
                        <div>
                          <span className="text-zinc-500">Noches: </span>
                          {nightsBetween(r.checkIn, r.checkOut)}
                        </div>
                        <div>
                          <span className="text-zinc-500">Personas: </span>
                          {r.numGuests}
                        </div>
                        <div>
                          <span className="text-zinc-500">Canal: </span>
                          <span className="uppercase text-xs">{r.channel}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500">Creada el: </span>
                          {formatDateTime(r.createdAt)}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setChat({
                              id: r.id,
                              title: `${r.code} · ${r.guestName ?? r.guest.name}`,
                            })
                          }
                          className="ml-auto text-sm bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-1.5 transition-colors"
                        >
                          Ver chat
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>

      <ChatDrawer
        reservationId={chat?.id ?? null}
        title={chat?.title}
        onClose={() => setChat(null)}
      />
    </>
  );
}
