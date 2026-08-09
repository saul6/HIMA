import { Outlet, useLocation, Link } from "react-router";
import { Home, PlusCircle, Package, History, User, Users, Search } from "lucide-react";
import { useModulosContext } from "@/context/ModulosContext";
import { useAuthContext } from "@/context/AuthContext";
import { useHomeSearch } from "@/context/HomeSearchContext";
import { MadyLogo } from "@/app/components/MadyLogo";

const PATH_TITLES: Record<string, string> = {
  '/': 'Inicio',
  '/nueva-aplicacion': 'Nueva Aplicación',
  '/inventario': 'Inventario',
  '/historial': 'Historial',
  '/equipo/actividad': 'Actividad del equipo',
  '/perfil': 'Perfil',
  '/perfil/mi-organizacion': 'Mi organización',
}

function getPageTitle(pathname: string): string {
  if (PATH_TITLES[pathname]) return PATH_TITLES[pathname]
  if (pathname.startsWith('/historial/')) return 'Detalle'
  if (pathname.startsWith('/inocuidad/')) {
    const seg = pathname.replace('/inocuidad/', '').replace(/-/g, ' ')
    return seg.charAt(0).toUpperCase() + seg.slice(1)
  }
  return 'M.A.D.Y'
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

const ROL_LABELS: Record<string, string> = {
  admin_org: 'Administrador',
  super_admin: 'Super Admin',
  asesor_tecnico: 'Asesor técnico',
  operario: 'Operario',
}

export function Layout() {
  const location = useLocation();
  const { profile } = useAuthContext();
  const { modulos, loading: loadingModulos, terminosSitio } = useModulosContext();
  const { busqueda, setBusqueda } = useHomeSearch();
  const isHome = location.pathname === '/';

  const esAdmin = profile?.rol === 'admin_org';
  const initials = profile?.nombre_completo ? getInitials(profile.nombre_completo) : '—';
  const fechaHoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const mostrarAplicaciones    = loadingModulos || modulos.some(m => m.clave === "aplicaciones");
  const mostrarInventario      = loadingModulos || modulos.some(m => m.clave === "inventario");
  const mostrarActividadEquipo = loadingModulos || (esAdmin && terminosSitio.singular !== 'Rancho');

  const navItems = [
    { path: "/",               icon: Home,       label: "Inicio"          },
    ...(mostrarAplicaciones    ? [{ path: "/nueva-aplicacion", icon: PlusCircle, label: "Nueva Aplicación" }] : []),
    ...(mostrarInventario      ? [{ path: "/inventario",       icon: Package,    label: "Inventario"       }] : []),
    { path: "/historial",      icon: History,    label: "Historial"       },
    ...(mostrarActividadEquipo ? [{ path: "/equipo/actividad", icon: Users,      label: "Actividad"        }] : []),
    { path: "/perfil",         icon: User,       label: "Perfil"          },
  ];

  const pageTitle = getPageTitle(location.pathname);

  function isActive(path: string) {
    return path === "/"
      ? location.pathname === "/" || location.pathname.startsWith("/inocuidad")
      : location.pathname.startsWith(path);
  }

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden bg-background">

      {/* ── Desktop Sidebar ───────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col md:w-[64px] lg:w-[220px] flex-shrink-0 border-r border-border bg-card">

        {/* Logo */}
        <div className="flex items-center justify-center px-2 pt-4 pb-3 lg:px-5 lg:pt-5 lg:pb-4 border-b border-border">
          <MadyLogo className="h-7 w-auto lg:h-9" />
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto px-1 lg:px-3 py-4 space-y-0.5">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = isActive(path);
            return (
              <Link
                key={path}
                to={path}
                title={label}
                className="flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-0 lg:px-3 py-2.5 rounded-lg text-sm transition-colors"
                style={{
                  backgroundColor: active ? 'var(--accent)' : undefined,
                  color: active ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                <Icon
                  className="w-5 h-5 lg:w-4 lg:h-4 flex-shrink-0"
                  style={{ color: active ? 'var(--primary)' : 'currentColor' }}
                  strokeWidth={active ? 2 : 1.5}
                />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User block */}
        <div className="px-2 lg:px-4 py-4 border-t border-border">
          <div className="flex items-center justify-center lg:justify-start gap-0 lg:gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--primary)', fontWeight: 700 }}
            >
              {initials}
            </div>
            <div className="hidden lg:block min-w-0">
              <p className="text-sm truncate" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
                {profile?.nombre_completo ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {ROL_LABELS[profile?.rol ?? ''] ?? profile?.rol ?? '—'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Right column: topbar + scrollable content ─────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Desktop top bar */}
        <header className="hidden md:grid md:grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-3 border-b border-border bg-card flex-shrink-0">
          {/* Left: page title */}
          <div className="min-w-0">
            <p className="text-sm" style={{ color: 'var(--foreground)', fontWeight: 600 }}>{pageTitle}</p>
            <p className="text-xs text-muted-foreground">
              {terminosSitio.singular !== 'Rancho' ? 'Instalaciones' : 'Campo'} · M.A.D.Y
            </p>
          </div>

          {/* Center: search — desktop + home route only */}
          <div className="flex justify-center">
            {isHome && (
              <div className="hidden lg:flex w-full max-w-xs relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: 'var(--muted-foreground)' }}
                />
                <input
                  type="search"
                  placeholder="Buscar formato…"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 rounded-lg text-sm outline-none transition-colors"
                  style={{
                    backgroundColor: 'var(--input-background)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)',
                  }}
                />
              </div>
            )}
          </div>

          {/* Right: date */}
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1)}
          </span>
        </header>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="w-full max-w-[390px] mx-auto md:max-w-[1600px] md:mx-0">
            <Outlet />
          </div>
        </div>
      </div>

      {/* ── Mobile Bottom Navigation ──────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-card border-t border-border pb-[34px] z-30">
        <div className="flex items-center justify-around h-[72px]">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = isActive(path);
            return (
              <Link
                key={path}
                to={path}
                className="flex flex-col items-center gap-1 flex-1 relative"
              >
                <Icon
                  className={`w-6 h-6 ${active ? "fill-primary text-primary" : "text-muted-foreground"}`}
                  strokeWidth={active ? 0 : 2}
                />
                <span
                  className={`text-[10px] ${active ? "text-primary" : "text-muted-foreground"}`}
                  style={{ fontWeight: active ? 600 : 400 }}
                >
                  {label}
                </span>
                {active && (
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
