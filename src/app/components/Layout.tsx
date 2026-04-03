import { Outlet, useLocation, Link } from "react-router";
import { Home, PlusCircle, Package, History, User } from "lucide-react";

const navItems = [
  { path: "/", icon: Home, label: "Inicio" },
  { path: "/nueva-aplicacion", icon: PlusCircle, label: "Nueva Aplicación" },
  { path: "/inventario", icon: Package, label: "Inventario" },
  { path: "/historial", icon: History, label: "Historial" },
  { path: "/perfil", icon: User, label: "Perfil" },
];

export function Layout() {
  const location = useLocation();

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA] max-w-[390px] mx-auto relative">
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-white border-t border-black/10 pb-[34px] z-30">
        <div className="flex items-center justify-around h-[72px]">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className="flex flex-col items-center gap-1 flex-1 relative"
              >
                <Icon
                  className={`w-6 h-6 ${
                    isActive ? "fill-[#2B7AB5] text-[#2B7AB5]" : "text-gray-600"
                  }`}
                  strokeWidth={isActive ? 0 : 2}
                />
                <span
                  className={`text-[10px] ${
                    isActive ? "text-[#2B7AB5]" : "text-gray-600"
                  }`}
                  style={{ fontWeight: isActive ? 600 : 400 }}
                >
                  {label}
                </span>
                {isActive && (
                  <div className="absolute -bottom-2 w-1 h-1 rounded-full bg-[#2B7AB5]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}