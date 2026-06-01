"use client";

import { useTransition } from "react";
import type { DeleteResult } from "@/app/dashboard/configuracion/actions";

export default function DeleteButton({
  action,
  confirmText = "¿Estás seguro?",
  disabled = false,
  disabledReason,
}: {
  action: () => Promise<DeleteResult>;
  confirmText?: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm(confirmText)) return;
    startTransition(async () => {
      const result = await action();
      if (!result.ok) alert(result.error);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isPending}
      title={disabled ? disabledReason : undefined}
      className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-800 text-red-400 hover:bg-red-900/40 hover:text-red-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {isPending ? "Eliminando…" : "Eliminar"}
    </button>
  );
}
