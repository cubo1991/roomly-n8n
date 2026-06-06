import { auth } from "@/auth";
import { redirect } from "next/navigation";
import NavLink from "@/components/dashboard/NavLink";
import LiveUpdates from "@/components/dashboard/LiveUpdates";
import { signOut } from "@/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Navbar */}
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-xl font-bold text-blue-400">Roomly</span>
            <nav className="flex gap-4 text-sm">
              <NavLink href="/dashboard" exact>
                Reservas
              </NavLink>
              <NavLink href="/dashboard/rooms">
                Habitaciones
              </NavLink>
              <NavLink href="/dashboard/configuracion">
                Configuración
              </NavLink>
            </nav>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>

      {/* SSE listener — updates the dashboard in real time when reservations change */}
      <LiveUpdates />
    </div>
  );
}
