"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ConfiguracionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Configuración error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 max-w-md w-full text-center">
        <h2 className="text-lg font-semibold text-red-300 mb-2">
          Error al guardar
        </h2>
        <p className="text-red-200 text-sm mb-4">
          {error.message || "Ocurrió un error inesperado."}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
          >
            Reintentar
          </button>
          <Link
            href="/dashboard/configuracion"
            className="px-4 py-2 rounded-lg text-sm bg-zinc-800 hover:bg-zinc-700 text-white transition-colors"
          >
            Volver
          </Link>
        </div>
      </div>
    </div>
  );
}
