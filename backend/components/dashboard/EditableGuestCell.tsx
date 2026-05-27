"use client";

import { useState, useTransition, useRef } from "react";
import { updateGuest } from "@/app/dashboard/actions";

type Props = {
  guestId: string;
  name: string;
  phone: string;
  email?: string | null;
  dni?: string | null;
};

export default function EditableGuestCell({ guestId, name, phone, email, dni }: Props) {
  const [editing, setEditing] = useState(false);
  const [currentName, setCurrentName] = useState(name);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSave(formData: FormData) {
    const newName = (formData.get("name") as string)?.trim();
    startTransition(async () => {
      await updateGuest(guestId, formData);
      if (newName) setCurrentName(newName);
      setEditing(false);
    });
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-left group w-full"
        title="Click para editar"
      >
        <div className="font-medium group-hover:text-blue-400 transition-colors">
          {currentName}
        </div>
        <div className="text-zinc-500 text-xs">{phone}</div>
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={handleSave}
      className="flex flex-col gap-1.5 min-w-[160px]"
    >
      <input
        name="name"
        defaultValue={currentName}
        autoFocus
        required
        placeholder="Nombre"
        className="bg-zinc-800 border border-blue-500 rounded px-2 py-1 text-sm text-white focus:outline-none w-full"
      />
      <input
        name="email"
        type="email"
        defaultValue={email ?? ""}
        placeholder="Email (opcional)"
        className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 w-full"
      />
      <input
        name="dni"
        defaultValue={dni ?? ""}
        placeholder="DNI (opcional)"
        className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-blue-500 w-full"
      />
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded px-2 py-1 transition-colors"
        >
          {isPending ? "…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-white rounded px-2 py-1 transition-colors"
        >
          Cancelar
        </button>
      </div>
      <div className="text-zinc-600 text-xs">{phone} (teléfono fijo)</div>
    </form>
  );
}
