import { useEffect, useState } from "react";
import { Outlet, useLocation, useMatches, Link } from "react-router";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { Home, PlusCircle, Package, History, Users, Search, Sun, Moon, ClipboardCheck, FileCheck2, X, Calendar, ListChecks, BarChart3, CloudUpload, WifiOff } from "lucide-react";
import { useModulosContext } from "@/context/ModulosContext";
import { useAuthContext } from "@/context/AuthContext";
import { useHomeSearch } from "@/context/HomeSearchContext";
import { useTheme } from "@/context/ThemeContext";
import { useIntroTransition } from "@/context/IntroTransitionContext";
import { IntroDevReplay } from "@/app/components/IntroDevReplay";
import { MadyLogo } from "@/app/components/MadyLogo";
import { Skeleton } from "@/app/components/ui/skeleton";
import { useOrgNombre } from "@/hooks/useOrgNombre";
import { useMostrarCarga } from "@/hooks/useMostrarCarga";
import { BottomSheet, fabMenuItemVariants } from "@/app/components/BottomSheet";
import { CampanaNotificaciones } from "@/app/components/CampanaNotificaciones";
import { AuditorBusqueda } from "@/app/screens/auditor/AuditorBusqueda";
import { CATEGORIA_MAP } from "@/lib/categoriasModulos";
import { useConexion } from "@/hooks/useConexion";
import { useOutbox } from "@/hooks/useOutbox";
import { AvisoVentana72h } from "@/app/components/AvisoVentana72h";

const PATH_TITLES: Record<string, string> = {
  '/': 'Inicio',
  '/nueva-aplicacion': 'Nueva Aplicación',
  '/inventario': 'Inventario',
  '/historial': 'Historial',
  '/equipo/actividad': 'Actividad del equipo',
  '/inocuidad/agenda': 'Agenda',
  '/inocuidad/checklist': 'Checklist de documentos',
  '/perfil': 'Perfil',
  '/perfil/mi-organizacion': 'Mi organización',
  '/metricas': 'Métricas',
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
  if (pathname.match(/^\/auditor\/org\//)) return 'Empresa auditada'
  return 'M.A.D.Y'
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

const ROL_LABELS: Record<string, string> = {
  admin_org: 'Administrador',
  auditor: 'Auditor',
  super_admin: 'Super Admin',
  asesor_tecnico: 'Asesor técnico',
  operario: 'Operario',
}

export function Layout() {
  const location = useLocation();
  // Las rutas hijas tipo ventana no reinician la transición de la página de fondo
  const matches = useMatches();
  const claveTransicion =
    [...matches].reverse().find(m => !(m.handle as { ventana?: boolean } | undefined)?.ventana)?.pathname ??
    location.pathname;
  const { profile } = useAuthContext();
  const { modulos, loading: loadingModulos, terminosSitio } = useModulosContext();
  const { busqueda, setBusqueda } = useHomeSearch();
  const { theme, resolvedTheme, cycleTheme } = useTheme();
  const isHome = location.pathname === '/';
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { markAppReady, ocultarLogoSidebar, faseContenido, logoAsienta } = useIntroTransition();
  const reducedMotion = useReducedMotion();

  // Señal determinística para el overlay de bienvenida (ver
  // IntroTransitionContext/LoginTransition): Layout es el shell común a
  // todo destino autenticado (Home y cualquier módulo), así que su montaje
  // es el punto correcto para avisar "la app ya está lista detrás del
  // overlay". No-op si no hay overlay activo.
  useEffect(() => {
    markAppReady()
  }, [markAppReady]);

  const { online } = useConexion();
  const { totalPendientes } = useOutbox();
  const esAuditor = profile?.rol === 'auditor';
  const { nombre: orgNombre, cargando: orgCargando } = useOrgNombre(!esAuditor);
  const mostrarSkeletonOrg = useMostrarCarga(orgCargando, false);
  const esAdmin   = profile?.rol === 'admin_org';
  const isAuditorHome = esAuditor && location.pathname === '/auditor';
  const initials  = profile?.nombre_completo ? getInitials(profile.nombre_completo) : '—';
  const fechaHoy = new Date().toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const mostrarAplicaciones    = !esAuditor && (loadingModulos || modulos.some(m => m.clave === "aplicaciones"));
  const mostrarInventario      = !esAuditor && (loadingModulos || modulos.some(m => m.clave === "inventario"));
  const mostrarActividadEquipo = !esAuditor && (loadingModulos || (esAdmin && terminosSitio.singular !== 'Rancho'));
  const mostrarAuditorias      = !esAuditor && ['admin_org', 'super_admin'].includes(profile?.rol ?? '');
  const mostrarAgendaTareas    = !esAuditor && !loadingModulos && modulos.some(m => m.clave === "agenda_tareas" && m.desbloqueado);
  const mostrarMetricas        = !esAuditor;
  const mostrarChecklist       = !esAuditor && ['admin_org', 'asesor_tecnico'].includes(profile?.rol ?? '') && !loadingModulos && modulos.some(m => m.codigo === 'M80' && m.desbloqueado);

  const homeItem = esAuditor
    ? { path: "/auditor",  icon: Home, label: "Inicio" }
    : { path: "/",         icon: Home, label: "Inicio" }

  const navItems = [
    homeItem,
    ...(esAuditor              ? [{ path: "/auditor/agenda",                icon: Calendar,       label: "Agenda"           }] : []),
    ...(mostrarAgendaTareas    ? [{ path: "/inocuidad/agenda",              icon: ListChecks,     label: "Agenda"           }] : []),
    ...(mostrarAplicaciones    ? [{ path: "/nueva-aplicacion",             icon: PlusCircle,     label: "Nueva Aplicación" }] : []),
    ...(mostrarInventario      ? [{ path: "/inventario",                    icon: Package,        label: "Inventario"       }] : []),
    ...(esAuditor              ? [] : [{ path: "/historial",                icon: History,        label: "Historial"        }]),
    ...(mostrarActividadEquipo ? [{ path: "/equipo/actividad",              icon: Users,          label: "Actividad"        }] : []),
    ...(mostrarAuditorias      ? [{ path: "/inocuidad/auditorias-primusgfs", icon: ClipboardCheck, label: "Auditorías"       }] : []),
    ...(mostrarChecklist       ? [{ path: "/inocuidad/checklist",           icon: FileCheck2,     label: "Checklist"        }] : []),
    ...(mostrarMetricas        ? [{ path: "/metricas",                        icon: BarChart3,      label: "Métricas"         }] : []),
  ];

  // Opciones del menú del isotipo: Perfil se abre desde la fila del usuario.
  const menuItems = navItems;

  const pageTitle = getPageTitle(location.pathname);
  const moduloActual = location.pathname.startsWith('/inocuidad/')
    ? modulos.find(m => m.ruta === location.pathname)
    : undefined;
  const categoriaLabel = moduloActual?.categoria ? CATEGORIA_MAP[moduloActual.categoria]?.label : undefined;
  const topbarTitulo = categoriaLabel ?? pageTitle;
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
          !location.pathname.startsWith("/inocuidad/auditorias-primusgfs") &&
          !location.pathname.startsWith("/inocuidad/agenda") &&
          !location.pathname.startsWith("/inocuidad/checklist"))
      )
    }
    return location.pathname.startsWith(path)
  }

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden bg-background">
      {import.meta.env.DEV && <IntroDevReplay />}

      {/* ── Desktop Sidebar ───────────────────────────────────────────────── */}
      <aside className="hidden md:flex flex-col md:w-[64px] lg:w-[220px] flex-shrink-0 border-r border-border bg-card">

        {/* Logo → Inicio — misma altura que el header de la derecha (h-14/h-16)
            para que ambos border-b queden en la misma línea; antes cada uno
            se dimensionaba por su propio padding vertical y no coincidían. */}
        <div className="flex items-center justify-center h-14 lg:h-16 px-2 lg:px-5 border-b border-border">
          <Link
            to="/"
            aria-label="Ir al inicio"
            className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary"
            style={{ opacity: ocultarLogoSidebar ? 0 : 1, transition: 'opacity 120ms ease-in-out' }}
          >
            <MadyLogo
              theme={resolvedTheme}
              className={`h-7 w-auto lg:h-12${logoAsienta ? ' intro-asienta' : ''}`}
              data-intro-destino="sidebar-logo"
            />
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
                className="relative flex items-center justify-center lg:justify-start gap-0 lg:gap-3 px-0 lg:px-3 py-2.5 rounded-lg text-sm transition-colors"
                style={{
                  color: active ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
                  fontWeight: active ? 600 : 400,
                }}
              >
                {active && (
                  <motion.span
                    layoutId="sidebarActiveIndicator"
                    className="absolute inset-0 rounded-lg"
                    style={{ backgroundColor: 'var(--accent)' }}
                    transition={reducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
                <Icon
                  className="relative z-10 w-5 h-5 lg:w-4 lg:h-4 flex-shrink-0"
                  style={{ color: active ? 'var(--primary)' : 'currentColor' }}
                  strokeWidth={active ? 2 : 1.5}
                />
                <span className="relative z-10 hidden lg:inline">{label}</span>
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
              <p
                className="text-sm truncate"
                style={{ color: 'var(--foreground)', fontWeight: 600 }}
                title={profile?.nombre_completo ?? undefined}
              >
                {profile?.nombre_completo ?? '—'}
              </p>
              <p
                className="text-xs text-muted-foreground truncate"
                title={ROL_LABELS[profile?.rol ?? ''] ?? profile?.rol ?? undefined}
              >
                {ROL_LABELS[profile?.rol ?? ''] ?? profile?.rol ?? '—'}
              </p>
            </div>
          </Link>
        </div>
      </aside>

      {/* ── Right column: topbar + scrollable content ─────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Desktop top bar — misma altura que el bloque del logo (h-14/h-16),
            ver comentario ahí. */}
        <header className="hidden md:grid md:grid-cols-[auto_1fr_auto] items-center gap-4 h-14 lg:h-16 px-6 border-b border-border bg-card flex-shrink-0">
          {/* Left: page title or greeting on home */}
          <div className="min-w-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={isHome || isAuditorHome ? 'home-greeting' : topbarTitulo}
                initial={reducedMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="text-sm"
                style={{ color: 'var(--foreground)', fontWeight: 600 }}
              >
                {isHome || isAuditorHome
                  ? `Hola, ${profile?.nombre_completo?.split(' ')[0] ?? '—'}`
                  : topbarTitulo}
              </motion.p>
            </AnimatePresence>
            <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0 h-4">
              {esAuditor ? (
                <span className="shrink-0">Auditores · M.A.D.Y</span>
              ) : orgCargando ? (
                mostrarSkeletonOrg && <Skeleton className="h-3 w-28" />
              ) : (
                <>
                  {orgNombre && <span className="truncate min-w-0">{orgNombre}</span>}
                  <span className="shrink-0">{orgNombre ? '· M.A.D.Y' : 'M.A.D.Y'}</span>
                </>
              )}
            </div>
          </div>

          {/* Center: search — desktop + home route only (auditor: su propio buscador) */}
          <div className="flex justify-center">
            {isAuditorHome && (
              <div className="w-full max-w-xs">
                <AuditorBusqueda />
              </div>
            )}
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

          {/* Right: campana + sync + theme toggle + date */}
          <div className="flex items-center gap-3">
            <CampanaNotificaciones />
            {/* Indicador de sincronización / conexión */}
            {(!online || totalPendientes > 0) && (
              <Link
                to="/sincronizacion"
                className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
                style={{
                  backgroundColor: !online ? 'var(--agro-danger-fill)' : 'var(--agro-warning-fill)',
                  color: !online ? 'var(--agro-danger-text)' : 'var(--agro-warning-text)',
                  fontWeight: 600,
                }}
                title={!online ? 'Sin conexión' : `${totalPendientes} pendientes de subir`}
              >
                {!online ? <WifiOff className="w-3.5 h-3.5" /> : <CloudUpload className="w-3.5 h-3.5" />}
                {!online ? 'Sin conexión' : `${totalPendientes}`}
              </Link>
            )}
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
          <AvisoVentana72h />
          <motion.div
            key={claveTransicion}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[390px] mx-auto md:max-w-none"
          >
            <div className={faseContenido === 'oculto' ? 'intro-contenido-oculto' : faseContenido === 'entra' ? 'intro-contenido-entra' : undefined}>
              <Outlet />
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Mobile FAB isotipo ───────────────────────────────────────────── */}
      <button
        onClick={() => setMenuAbierto(true)}
        className="md:hidden fixed bottom-safe-fab left-4 w-14 h-14 rounded-full flex items-center justify-center z-40 bg-card border border-border active:scale-95 transition-transform no-press"
        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}
        aria-label="Abrir menú"
      >
        <img src="/images/MADYIsotipo.png" alt="" aria-hidden="true" className="w-7 h-7 object-contain" />
      </button>

      {/* ── Mobile Menu Sheet ─────────────────────────────────────────────── */}
      <BottomSheet open={menuAbierto} onClose={() => setMenuAbierto(false)} animateFrom="bottom-left">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <MadyLogo theme={resolvedTheme} className="h-6 w-auto" />
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
        <div className="border-b border-border">
          <Link
            to="/perfil"
            aria-label="Ir a mi perfil"
            onClick={() => setMenuAbierto(false)}
            className="flex items-center gap-3 px-4 py-3 transition-[background-color,transform] duration-150 hover:bg-muted active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            style={{ backgroundColor: isActive('/perfil') ? 'var(--accent)' : undefined }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--primary)' }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p
                className="text-sm truncate font-semibold"
                style={{ color: 'var(--foreground)' }}
                title={profile?.nombre_completo ?? undefined}
              >
                {profile?.nombre_completo ?? '—'}
              </p>
              <p
                className="text-xs truncate text-muted-foreground"
                title={ROL_LABELS[profile?.rol ?? ''] ?? profile?.rol ?? undefined}
              >
                {ROL_LABELS[profile?.rol ?? ''] ?? profile?.rol ?? '—'}
              </p>
            </div>
          </Link>
        </div>

        {/* Opciones de navegación */}
        <div className="flex-1 overflow-y-auto py-1">
          {menuItems.map(({ path, icon: Icon, label }) => {
            const active = isActive(path);
            return (
              <motion.div key={path} variants={fabMenuItemVariants}>
                <Link
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
              </motion.div>
            );
          })}
        </div>

        {/* Campana */}
        <div className="px-4 py-1.5 border-t border-border flex items-center gap-4">
          {/* La caja de la campana (32px) se desplaza para que el ícono de 20px
              quede en la misma columna que los de la lista. */}
          <div className="-ml-1.5 mr-[-6px]">
            <CampanaNotificaciones iconClassName="w-5 h-5" />
          </div>
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>Notificaciones</span>
        </div>

        {/* Sincronización (solo si hay pendientes o sin conexión) */}
        {(!online || totalPendientes > 0) && (
          <Link
            to="/sincronizacion"
            onClick={() => setMenuAbierto(false)}
            className="flex items-center gap-4 px-4 py-3 border-t border-border"
          >
            {!online
              ? <WifiOff className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--agro-danger-text)' }} />
              : <CloudUpload className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--agro-warning-text)' }} />}
            <span className="text-sm" style={{ color: !online ? 'var(--agro-danger-text)' : 'var(--agro-warning-text)', fontWeight: 600 }}>
              {!online ? 'Sin conexión' : `${totalPendientes} pendiente${totalPendientes !== 1 ? 's' : ''} de subir`}
            </span>
          </Link>
        )}

        {/* Switch de tema */}
        <button
          onClick={e => { cycleTheme(e.currentTarget as HTMLElement); }}
          className="w-full flex items-center gap-4 px-4 py-3 border-t border-border hover:bg-muted transition-colors text-left"
          aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
        >
          <ThemeIcon className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          <span className="text-sm" style={{ color: 'var(--foreground)' }}>{themeLabel}</span>
        </button>
      </BottomSheet>
    </div>
  );
}
