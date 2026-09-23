import { useEffect, useState } from "react";
import { Outlet, useLocation, Link } from "react-router";
import { Home, PlusCircle, Package, History, User, Users, Search, Sun, Moon, ClipboardCheck, X, Calendar } from "lucide-react";
import { useModulosContext } from "@/context/ModulosContext";
import { useAuthContext } from "@/context/AuthContext";
import { useHomeSearch } from "@/context/HomeSearchContext";
import { useTheme } from "@/context/ThemeContext";
import { useIntroTransition } from "@/context/IntroTransitionContext";
import { MadyLogo } from "@/app/components/MadyLogo";
import { BottomSheet } from "@/app/components/BottomSheet";
import { AuditorCampana } from "@/app/screens/auditor/AuditorCampana";

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
  if (pathname === '/auditor') return 'Mis organizaciones'
  if (pathname === '/auditor/agenda') return 'Agenda'
  if (pathname.match(/^\/auditor\/auditoria\//)) return 'Ejecución'
  if (pathname.match(/^\/auditor\/org\/[^/]+\/nueva/)) return 'Nueva auditoría'
  if (pathname.match(/^\/auditor\/org\//)) return 'Empresa auditada'
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
  const { theme, resolvedTheme, cycleTheme } = useTheme();
  const isHome = location.pathname === '/';
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { markAppReady } = useIntroTransition();

  // Señal determinística para el overlay de bienvenida (ver
  // IntroTransitionContext/LoginTransition): Layout es el shell común a
  // todo destino autenticado (Home y cualquier módulo), así que su montaje
  // es el punto correcto para avisar "la app ya está lista detrás del
  // overlay". No-op si no hay overlay activo.
  useEffect(() => {
    markAppReady()
  }, [markAppReady]);

  const esAuditor = profile?.rol === 'auditor';
  const esAdmin   = profile?.rol === 'admin_org';
  const initials  = profile?.nombre_completo ? getInitials(profile.nombre_completo) : '—';
  const fechaHoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const mostrarAplicaciones    = !esAuditor && (loadingModulos || modulos.some(m => m.clave === "aplicaciones"));
  const mostrarInventario      = !esAuditor && (loadingModulos || modulos.some(m => m.clave === "inventario"));
  const mostrarActividadEquipo = !esAuditor && (loadingModulos || (esAdmin && terminosSitio.singular !== 'Rancho'));
  const mostrarAuditorias      = !esAuditor && ['admin_org', 'super_admin'].includes(profile?.rol ?? '');

  const homeItem = esAuditor
    ? { path: "/auditor",  icon: Home, label: "Inicio" }
    : { path: "/",         icon: Home, label: "Inicio" }

  const navItems = [
    homeItem,
    ...(esAuditor              ? [{ path: "/auditor/agenda",                icon: Calendar,       label: "Agenda"           }] : []),
    ...(mostrarAplicaciones    ? [{ path: "/nueva-aplicacion",              icon: PlusCircle,     label: "Nueva Aplicación" }] : []),
    ...(mostrarInventario      ? [{ path: "/inventario",                    icon: Package,        label: "Inventario"       }] : []),
    ...(esAuditor              ? [] : [{ path: "/historial",                icon: History,        label: "Historial"        }]),
    ...(mostrarActividadEquipo ? [{ path: "/equipo/actividad",              icon: Users,          label: "Actividad"        }] : []),
    ...(mostrarAuditorias      ? [{ path: "/inocuidad/auditorias-primusgfs", icon: ClipboardCheck, label: "Auditorías"       }] : []),
  ];

  // Todas las opciones para el menú del isotipo (navItems completos + Perfil)
  const menuItems = [
    ...navItems,
    { path: "/perfil", icon: User, label: "Perfil" },
  ];

  const pageTitle = getPageTitle(location.pathname);
  const ThemeIcon = theme === 'dark' ? Moon : Sun;
  const themeLabel = theme === 'dark' ? 'Oscuro' : 'Claro';

  function isActive(path: string) {
    if (path === "/auditor") {
      return (
        location.pathname === '/auditor' ||
        (location.pathname.startsWith('/auditor/') && location.pathname !== '/auditor/agenda')
      )
    }
    if (path === "/auditor/agenda") {
      return location.pathname === '/auditor/agenda'
    }
    if (path === "/") {
      return (
        location.pathname === "/" ||
        (location.pathname.startsWith("/inocuidad") &&
          !location.pathname.startsWith("/inocuidad/auditorias-primusgfs"))
      )
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden bg-background">

      {/* ── Desktop Sidebar ───────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col md:w-[64px] lg:w-[220px] flex-shrink-0 border-r border-border bg-card">

        {/* Logo → Inicio */}
        <div className="flex items-center justify-center px-2 pt-4 pb-3 lg:px-5 lg:pt-5 lg:pb-4 border-b border-border">
          <Link
            to="/"
            aria-label="Ir al inicio"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
          >
            <MadyLogo theme={resolvedTheme} className="h-7 w-auto lg:h-9" />
          </Link>
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

        {/* Theme toggle */}
        <div className="px-1 lg:px-3 py-2 border-t border-border">
          <button
            onClick={e => cycleTheme(e.currentTarget as HTMLElement)}
            className="w-full flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-0 lg:px-3 py-2.5 rounded-lg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
            aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
            title={themeLabel}
          >
            <ThemeIcon
              className="w-5 h-5 lg:w-4 lg:h-4 flex-shrink-0"
              style={{ color: 'var(--muted-foreground)' }}
            />
            <span className="hidden lg:inline text-sm" style={{ color: 'var(--muted-foreground)' }}>
              {themeLabel}
            </span>
          </button>
        </div>

        {/* User block → Perfil */}
        <div className="px-1 lg:px-3 py-2 border-t border-border">
          <Link
            to="/perfil"
            aria-label="Ir a perfil"
            className="flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-1 lg:px-2 py-2 rounded-lg transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
            style={{
              backgroundColor: isActive('/perfil') ? 'var(--accent)' : undefined,
            }}
          >
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
          </Link>
        </div>
      </aside>

      {/* ── Right column: topbar + scrollable content ─────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Desktop top bar */}
        <header className="hidden md:grid md:grid-cols-[auto_1fr_auto] items-center gap-4 px-6 py-3 border-b border-border bg-card flex-shrink-0">
          {/* Left: page title or greeting on home */}
          <div className="min-w-0">
            <p className="text-sm" style={{ color: 'var(--foreground)', fontWeight: 600 }}>
              {isHome
                ? `Hola, ${profile?.nombre_completo?.split(' ')[0] ?? '—'}`
                : pageTitle}
            </p>
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

          {/* Right: campana (auditor) + theme toggle + date */}
          <div className="flex items-center gap-3">
            {esAuditor && <AuditorCampana />}
            <button
              onClick={e => cycleTheme(e.currentTarget as HTMLElement)}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
              aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
              title={themeLabel}
            >
              <ThemeIcon className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
            </button>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1)}
            </span>
          </div>
        </header>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="w-full max-w-[390px] mx-auto md:max-w-none">
            <Outlet />
          </div>
        </div>
      </div>

      {/* ── Mobile FAB isotipo ───────────────────────────────────────────── */}
      <button
        onClick={() => setMenuAbierto(true)}
        className="md:hidden fixed bottom-safe-fab left-4 w-14 h-14 rounded-full flex items-center justify-center z-40 bg-card border border-border active:scale-95 transition-transform"
        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}
        aria-label="Abrir menú"
      >
        <svg width="28" height="28" viewBox="0 0 100 100" aria-hidden="true">
          <rect x="6"  y="6"  width="40" height="40" rx="12" fill="#81BEE5" />
          <rect x="54" y="6"  width="40" height="40" rx="12" fill="#173251" />
          <rect x="6"  y="54" width="40" height="40" rx="12" fill="#173251" />
          <rect x="54" y="54" width="40" height="40" rx="12" fill="#2AAD95" />
        </svg>
      </button>

      {/* ── Mobile Menu Sheet ─────────────────────────────────────────────── */}
      <BottomSheet open={menuAbierto} onClose={() => setMenuAbierto(false)}>
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <img src="/images/MADYy.png" alt="M.A.D.Y" className="h-6 w-auto object-contain" />
            <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>M.A.D.Y</span>
          </div>
          <button
            onClick={() => setMenuAbierto(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
          </button>
        </div>

        {/* Usuario */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--primary)' }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm truncate font-semibold" style={{ color: 'var(--foreground)' }}>
                {profile?.nombre_completo ?? '—'}
              </p>
              <p className="text-xs truncate text-muted-foreground">
                {ROL_LABELS[profile?.rol ?? ''] ?? profile?.rol ?? '—'}
              </p>
            </div>
          </div>
        </div>

        {/* Opciones de navegación */}
        <div className="flex-1 overflow-y-auto py-1">
          {menuItems.map(({ path, icon: Icon, label }) => {
            const active = isActive(path);
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setMenuAbierto(false)}
                className="flex items-center gap-4 px-4 py-3 transition-colors"
                style={{
                  backgroundColor: active ? 'var(--accent)' : undefined,
                  color: active ? 'var(--accent-foreground)' : 'var(--foreground)',
                }}
              >
                <Icon
                  className="w-5 h-5 flex-shrink-0"
                  style={{ color: active ? 'var(--primary)' : 'var(--muted-foreground)' }}
                  strokeWidth={active ? 2 : 1.5}
                />
                <span className="text-sm" style={{ fontWeight: active ? 600 : 400 }}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Campana (auditor) */}
        {esAuditor && (
          <div className="px-4 py-3 border-t border-border flex items-center gap-4">
            <AuditorCampana />
            <span className="text-sm" style={{ color: 'var(--foreground)' }}>Notificaciones</span>
          </div>
        )}

        {/* Switch de tema */}
        <div className="px-4 py-3 border-t border-border">
          <button
            onClick={e => { cycleTheme(e.currentTarget as HTMLElement); }}
            className="w-full flex items-center gap-4 py-2 rounded-lg hover:bg-muted transition-colors"
            aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
          >
            <ThemeIcon className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
            <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>{themeLabel}</span>
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
