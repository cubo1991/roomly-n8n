"use client";

import { useEffect, useState } from "react";
import { getReservationChat } from "@/app/dashboard/actions";

type ChatMessage = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  content: string;
  createdAt: Date | string;
};

function formatTime(d: Date | string) {
  return new Date(d).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ChatDrawer({
  reservationId,
  title,
  onClose,
}: {
  reservationId: string | null;
  title?: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const open = reservationId !== null;

  useEffect(() => {
    if (!reservationId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setMessages([]);
      try {
        const data = await getReservationChat(reservationId);
        if (!cancelled) setMessages(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [reservationId]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-zinc-900 border-l border-zinc-800 flex flex-col shadow-xl">
        <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div>
            <h2 className="font-semibold">Conversación</h2>
            {title && <p className="text-xs text-zinc-500">{title}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {loading && (
            <p className="text-center text-zinc-500 text-sm py-8">Cargando…</p>
          )}
          {!loading && messages.length === 0 && (
            <p className="text-center text-zinc-500 text-sm py-8">
              No hay mensajes guardados para esta reserva.
            </p>
          )}
          {messages.map((m) => {
            const isBot = m.direction === "OUTBOUND";
            return (
              <div
                key={m.id}
                className={`flex ${isBot ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    isBot
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p
                    className={`mt-1 text-[10px] ${
                      isBot ? "text-blue-200" : "text-zinc-500"
                    }`}
                  >
                    {formatTime(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
