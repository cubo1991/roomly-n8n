"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Reservation = {
  id: string;
  code: string;
  status: string;
  channel: string;
  checkIn: Date;
  checkOut: Date;
  numGuests: number;
  room: { number: string };
  guest: { name: string; phone: string };
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
  return new Date(d).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function nightsBetween(a: Date, b: Date) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

export default function ReservationTable({
  reservations,
}: {
  reservations: Reservation[];
}) {
  if (reservations.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500 text-sm">
        No hay reservas registradas.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-zinc-800 hover:bg-transparent">
          <TableHead className="text-zinc-400">Código</TableHead>
          <TableHead className="text-zinc-400">Huésped</TableHead>
          <TableHead className="text-zinc-400">Hab.</TableHead>
          <TableHead className="text-zinc-400">Check-in</TableHead>
          <TableHead className="text-zinc-400">Check-out</TableHead>
          <TableHead className="text-zinc-400">Noches</TableHead>
          <TableHead className="text-zinc-400">Personas</TableHead>
          <TableHead className="text-zinc-400">Estado</TableHead>
          <TableHead className="text-zinc-400">Canal</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reservations.map((r) => {
          const { label, variant } = statusConfig[r.status] ?? {
            label: r.status,
            variant: "outline" as const,
          };
          return (
            <TableRow key={r.id} className="border-zinc-800 hover:bg-zinc-800/50">
              <TableCell className="font-mono text-blue-400">{r.code}</TableCell>
              <TableCell>
                <div className="font-medium">{r.guest.name}</div>
                <div className="text-zinc-500 text-xs">{r.guest.phone}</div>
              </TableCell>
              <TableCell>{r.room.number}</TableCell>
              <TableCell>{formatDate(r.checkIn)}</TableCell>
              <TableCell>{formatDate(r.checkOut)}</TableCell>
              <TableCell>{nightsBetween(r.checkIn, r.checkOut)}</TableCell>
              <TableCell>{r.numGuests}</TableCell>
              <TableCell>
                <Badge variant={variant}>{label}</Badge>
              </TableCell>
              <TableCell>
                <span className="text-xs text-zinc-500 uppercase">{r.channel}</span>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
