"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({
  children = "Guardar",
  variant = "primary",
}: {
  children?: React.ReactNode;
  variant?: "primary" | "danger";
}) {
  const { pending } = useFormStatus();

  const base =
    "px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const styles = {
    primary: "bg-blue-600 hover:bg-blue-500 text-white",
    danger: "bg-red-700 hover:bg-red-600 text-white",
  };

  return (
    <button type="submit" disabled={pending} className={`${base} ${styles[variant]}`}>
      {pending ? "Guardando…" : children}
    </button>
  );
}
