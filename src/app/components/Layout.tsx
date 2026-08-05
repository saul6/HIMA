import { Outlet, useLocation, Link } from "react-router";
import { Home, PlusCircle, Package, History, User, Users } from "lucide-react";
import { useModulosContext } from "@/context/ModulosContext";
import { useAuthContext } from "@/context/AuthContext";

export function Layout() {
  const location = useLocation();
  const { profile } = useAuthContext();
  const { modulos, loading: loadingModulos, terminosSitio } = useModulosContext();

  const esAdmin = profile?.rol === 'admin_org';

  // Durante la carga se mantienen visibles para evitar salto de layout
  const mostrarAplicaciones    = loadingModulos || modulos.some(m => m.clave === "aplicaciones");
  const mostrarInventario      = loadingModulos || modulos.some(m => m.clave === "inventario");
  const mostrarActividadEquipo = loadingModulos || (esAdmin && terminosSitio.singular !== 'Rancho');

  const navItems = [
    { path: "/", icon: Home, label: "Inicio" },
    ...(mostrarAplicaciones    ? [{ path: "/nueva-aplicacion",  icon: PlusCircle, label: "Nueva Aplicación" }] : []),
    ...(mostrarInventario      ? [{ path: "/inventario",        icon: Package,    label: "Inventario"       }] : []),
    { path: "/historial", icon: History, label: "Historial" },
    ...(mostrarActividadEquipo ? [{ path: "/equipo/actividad",  icon: Users,      label: "Actividad"        }] : []),
    { path: "/perfil",    icon: User,    label: "Perfil" },
  ];

  return (
    <div className="h-screen flex flex-col bg-background max-w-[390px] mx-auto relative">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-card border-t border-border pb-[34px] z-30">
        <div className="flex items-center justify-around h-[72px]">
          {navItems.map(({ path, icon: Icon, label }) => {
            // "Inicio" (path="/") también queda activo en rutas /inocuidad/*
            const isActive =
              path === "/"
                ? location.pathname === "/" || location.pathname.startsWith("/inocuidad")
                : location.pathname.startsWith(path);
            return (
              <Link
                key={path}
                to={path}
                className="flex flex-col items-center gap-1 flex-1 relative"
              >
                <Icon
                  className={`w-6 h-6 ${
                    isActive ? "fill-primary text-primary" : "text-muted-foreground"
                  }`}
                  strokeWidth={isActive ? 0 : 2}
                />
                <span
                  className={`text-[10px] ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                  style={{ fontWeight: isActive ? 600 : 400 }}
                >
                  {label}
                </span>
                {isActive && (
                  <div className="absolute -bottom-2 w-1 h-1 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}