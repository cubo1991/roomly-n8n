"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Link de navegación que se resalta cuando la ruta actual coincide.
 * `exact` para rutas que no deben activarse en sus sub-rutas (ej. /dashboard).
 */
export default function NavLink({
  href,
  exact = false,
  children,
}: {
  href: string;
  exact?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`transition-colors ${
        active ? "text-blue-400 font-medium" : "text-zinc-400 hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
