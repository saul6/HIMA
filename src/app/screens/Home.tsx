import { useState, useMemo, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link, Navigate } from 'react-router'
import { animate } from 'motion'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import {
  TriangleAlert, Clock3,
  Users, AlertTriangle, ChevronRight, ClipboardList, BarChart2,
  FileCheck, ShieldAlert, Search, Pin, X, Sun, Moon, Lock, ListChecks,
} from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { useFirmaContext } from '@/context/FirmaContext'
import { supabase } from '@/lib/supabase'
import { useHomeDashboard } from '@/hooks/useHomeDashboard'
import { useDashboardResumen } from '@/hooks/useDashboardResumen'
import { useCorreccionesPendientes } from '@/hooks/useCorreccionesPendientes'
import { useAgendaResumen } from '@/hooks/useAgendaResumen'
import { useModulosContext } from '@/context/ModulosContext'
import { useHomeSearch } from '@/context/HomeSearchContext'
import { useTheme } from '@/context/ThemeContext'
import { useContadorAnimado } from '@/hooks/useContadorAnimado'
import { resolverIcono } from '@/app/components/iconos-modulos'
import { MadyLogo } from '@/app/components/MadyLogo'
import { BottomSheet } from '@/app/components/BottomSheet'
import type { ModuloVisible } from '@/hooks/useMisModulos'
import { CATEGORIA_MAP } from '@/lib/categoriasModulos'
import { ordenarAlfabetico } from '@/lib/ordenAlfabetico'
import { SPRING_SUAVE } from '@/lib/motion'

const MAX_PINNED = 4
// Foco visible por teclado — nunca `ring-*` (usa box-shadow, prohibido).
const FOCUS_RING = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatFechaCorta(iso: string): string {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('es-MX', {
      day: 'numeric', month: 'short',
    })
  } catch {
    return iso
  }
}

function formatHa(ha: number): string {
  if (ha === 0) return '0'
  return ha % 1 === 0 ? String(ha) : ha.toFixed(1)
}

function formatDias(dias: number | null): string {
  if (dias === null) return '—'
  if (dias === 0) return 'Hoy'
  if (dias === 1) return '1 día'
  return `${dias} días`
}

// Entrada en cascada — solo en la carga inicial de cada lista (ver refs
// `primeraCarga*Ref` más abajo). Máx. 8 ítems escalonados, 35ms entre cada uno.
function cascadeStyle(index: number, enabled: boolean) {
  if (!enabled) return undefined
  return {
    animation: 'slideUpFade var(--motion-base) var(--ease-out) both',
    animationDelay: `${Math.min(index, 7) * 35}ms`,
  }
}

// Entrada de chips del buscador — stagger de 20ms, solo primeros 6.
function searchCascadeStyle(index: number, enabled: boolean) {
  if (!enabled) return undefined
  return {
    animation: 'searchResultFade var(--motion-fast) var(--ease-out) both',
    animationDelay: `${Math.min(index, 5) * 20}ms`,
  }
}

// Envuelve la parte de `nombre` que coincide con `query` (misma comparación
// que el filtro: lowercase, sin normalizar acentos) en un span más grueso.
function resaltarCoincidencia(nombre: string, query: string): ReactNode {
  const q = query.trim().toLowerCase()
  if (!q) return nombre
  const idx = nombre.toLowerCase().indexOf(q)
  if (idx === -1) return nombre
  return (
    <>
      {nombre.slice(0, idx)}
      <span style={{ fontWeight: 700 }}>{nombre.slice(idx, idx + q.length)}</span>
      {nombre.slice(idx + q.length)}
    </>
  )
}

// ── Sub-componentes locales ────────────────────────────────────────────────────

/** Contador animado: en cada montaje cuenta desde 0; si el valor cambia con
 * el componente ya montado (ver `prevValorRef`), anima del valor anterior al
 * nuevo en vez de saltar directo. `format` decide el texto exacto (mismos
 * decimales/unidades que hoy); si `value` es null no anima — solo pinta el
 * fallback. */
function AnimatedNumber({
  value,
  format,
  reducedMotion,
}: {
  value: number | null
  format: (n: number) => string
  reducedMotion: boolean
}) {
  const spanRef = useContadorAnimado(value, format, reducedMotion)
  return <span ref={spanRef} className="tabular-nums">{value === null ? '—' : format(value)}</span>
}

function MetricCard({
  loading,
  icon,
  value,
  numericValue,
  format,
  reducedMotion,
  label,
}: {
  loading: boolean
  icon?: ReactNode
  value: string
  /** Si se da junto con `format`, el valor anima de 0 al final (una vez). */
  numericValue?: number | null
  format?: (n: number) => string
  reducedMotion?: boolean
  label: string
}) {
  return (
    <div
      className="rounded-xl p-4 border border-border"
      style={{ backgroundColor: 'var(--agro-background)' }}
    >
      {loading ? (
        <div className="animate-pulse mb-2">
          <div className="h-7 rounded w-12" style={{ backgroundColor: 'var(--muted)' }} />
        </div>
      ) : (
        <div className="text-3xl tracking-tight mb-1 flex items-end gap-1.5" style={{ fontWeight: 600 }}>
          {icon}
          {numericValue !== undefined && format
            ? <AnimatedNumber value={numericValue} format={format} reducedMotion={!!reducedMotion} />
            : value}
        </div>
      )}
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

function HallazgosCard({
  loading,
  value,
  reducedMotion,
}: {
  loading: boolean
  value: number
  reducedMotion?: boolean
}) {
  const alerta = value > 0
  const inner = (
    <>
      {loading ? (
        <div className="animate-pulse mb-1">
          <div className="h-7 rounded w-8" style={{ backgroundColor: alerta ? 'var(--agro-amber)' : 'var(--muted)', opacity: 0.4 }} />
        </div>
      ) : (
        <div
          className="text-3xl tracking-tight mb-1 flex items-end gap-1.5"
          style={{ fontWeight: 600, color: alerta ? 'var(--agro-warning-text)' : 'var(--foreground)' }}
        >
          <ShieldAlert
            className="w-4 h-4 mb-1 flex-shrink-0"
            style={{ color: alerta ? 'var(--agro-warning-text)' : 'var(--muted-foreground)' }}
          />
          <AnimatedNumber value={value} format={(n) => String(Math.round(n))} reducedMotion={!!reducedMotion} />
        </div>
      )}
      <div
        className="text-xs"
        style={{ color: alerta ? 'var(--agro-warning-text)' : 'var(--muted-foreground)' }}
      >
        Hallazgos por corregir
      </div>
    </>
  )

  if (alerta) {
    return (
      <Link
        to="/inocuidad/acciones-correctivas"
        className={`block rounded-xl p-4 border ${FOCUS_RING}`}
        style={{
          backgroundColor: 'var(--agro-warning-fill)',
          borderColor: 'var(--agro-amber)',
        }}
      >
        {inner}
      </Link>
    )
  }
  return (
    <div
      className="rounded-xl p-4 border border-border"
      style={{ backgroundColor: 'var(--agro-background)' }}
    >
      {inner}
    </div>
  )
}

// ── CategoriaPopup ─────────────────────────────────────────────────────────────

interface CategoriaGrupo {
  key: string
  label: string
  icono: string
  modulos: ModuloVisible[]
}

interface CategoriaPopupProps {
  grupo: CategoriaGrupo
  modulosFijados: string[]
  toggleFijar: (codigo: string) => void
  onClose: () => void
  onBloqueado: (modulo: ModuloVisible) => void
}

function CategoriaPopup({ grupo, modulosFijados, toggleFijar, onClose, onBloqueado }: CategoriaPopupProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const listaRef = useRef<HTMLDivElement>(null)
  const GrupoIcon = resolverIcono(grupo.icono)
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // Overflow oculto durante el stagger para evitar barra parpadeante
  const [animating, setAnimating] = useState(!prefersReducedMotion)
  useEffect(() => {
    if (!animating) return
    const totalMs = (grupo.modulos.length - 1) * 90 + 220 + 30
    const id = setTimeout(() => setAnimating(false), totalMs)
    return () => clearTimeout(id)
  }, [animating, grupo.modulos.length])

  // Borde de la cabecera: transparente hasta que la lista tenga scroll
  const [listaConScroll, setListaConScroll] = useState(false)
  useEffect(() => {
    const el = listaRef.current
    if (!el) return
    function onScroll() { setListaConScroll(el!.scrollTop > 0) }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Foco inicial + trampa de foco + Esc
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return

    const getFocusable = () =>
      Array.from(
        el.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      )

    getFocusable()[0]?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'Tab') {
        const focusable = getFocusable()
        if (focusable.length === 0) { e.preventDefault(); return }
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last?.focus() }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first?.focus() }
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <BottomSheet open onClose={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cat-popup-title"
      >
        {/* Handle bar — solo móvil */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div
            className="w-10 h-1 rounded-full"
            style={{ backgroundColor: 'var(--muted-foreground)', opacity: 0.3 }}
          />
        </div>

        {/* Cabecera — borde inferior transparente hasta que la lista haga scroll */}
        <div
          className={`flex items-center gap-3 px-4 py-3 border-b transition-colors duration-[var(--motion-fast)] ${
            listaConScroll ? 'border-border' : 'border-transparent'
          }`}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'var(--agro-success-fill)' }}
          >
            <GrupoIcon className="w-5 h-5" style={{ color: 'var(--agro-success-text)' }} />
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span
              id="cat-popup-title"
              className="text-sm text-foreground truncate"
              style={{ fontWeight: 600 }}
            >
              {grupo.label}
            </span>
            <span
              className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: 'var(--agro-success-fill)',
                color: 'var(--agro-success-text)',
                fontWeight: 600,
              }}
            >
              {grupo.modulos.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-muted flex-shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Lista de módulos — overflow oculto mientras dura el stagger */}
        <div
          ref={listaRef}
          className="no-scrollbar"
          style={{ maxHeight: 'calc(85vh - 9rem)', overflowY: animating ? 'hidden' : 'auto' }}
        >
          {grupo.modulos.map((modulo, index) => {
            const ModIcon = resolverIcono(modulo.icono)
            const esBloqueado = !modulo.desbloqueado
            const esFijado = modulosFijados.includes(modulo.codigo)
            const puedeFijar = !esBloqueado && (esFijado || modulosFijados.length < MAX_PINNED)
            const animStyle = prefersReducedMotion
              ? undefined
              : { animation: 'slideUpFade 0.22s ease both', animationDelay: `${index * 90}ms` }
            return (
              <div
                key={modulo.codigo}
                className="border-b border-border last:border-b-0"
                style={animStyle}
              >
                {esBloqueado ? (
                  <button
                    onClick={() => onBloqueado(modulo)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left ${FOCUS_RING}`}
                    style={{ opacity: 0.55 }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'var(--muted)' }}
                    >
                      <ModIcon className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
                    </div>
                    <span className="flex-1 text-sm text-muted-foreground" style={{ fontWeight: 600 }}>
                      {modulo.nombre}
                    </span>
                    <Lock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                  </button>
                ) : (
                  <Link
                    to={modulo.ruta}
                    onClick={onClose}
                    className={`group flex items-center gap-3 px-4 py-3.5 hover:bg-muted transition-colors ${FOCUS_RING}`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      <ModIcon className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                    </div>
                    <span className="flex-1 text-sm text-foreground" style={{ fontWeight: 600 }}>
                      {modulo.nombre}
                    </span>
                    {puedeFijar && (
                      <button
                        onClick={e => {
                          e.preventDefault()
                          e.stopPropagation()
                          const vaAFijar = !esFijado
                          toggleFijar(modulo.codigo)
                          if (!prefersReducedMotion) {
                            const svg = e.currentTarget.querySelector('svg')
                            if (svg) {
                              animate(
                                svg,
                                vaAFijar
                                  ? { scale: [1, 1.25, 1], rotate: [0, -20, 0] }
                                  : { scale: [1, 1.25, 1], rotate: [0, 20, 0] },
                                SPRING_SUAVE,
                              )
                            }
                          }
                        }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:bg-accent ${FOCUS_RING}`}
                        aria-label={esFijado ? 'Quitar de accesos rápidos' : 'Fijar en accesos rápidos'}
                        title={esFijado ? 'Quitar' : 'Fijar'}
                      >
                        <Pin
                          className="w-3.5 h-3.5"
                          style={{
                            color: esFijado ? 'var(--secondary)' : 'var(--muted-foreground)',
                            fill: esFijado ? 'var(--secondary)' : 'none',
                          }}
                        />
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-[var(--motion-fast)] group-hover:translate-x-0.5" />
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </BottomSheet>
  )
}

// ── UpsellModal ───────────────────────────────────────────────────────────────

function UpsellModal({ modulo, onClose }: { modulo: ModuloVisible | null; onClose: () => void }) {
  if (!modulo) return null
  const ModIcon = resolverIcono(modulo.icono)
  const mailtoHref = `mailto:ventas@mady.com.mx?subject=${encodeURIComponent(`Activar módulo: ${modulo.nombre}`)}`
  return (
    <BottomSheet open onClose={onClose}>
      <div>
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--muted-foreground)', opacity: 0.3 }} />
        </div>
        <div className="px-6 py-6 flex flex-col items-center text-center gap-4">
          <div className="relative">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <ModIcon className="w-6 h-6" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }} />
            </div>
            <div
              className="absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center border-2"
              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <Lock className="w-2.5 h-2.5" style={{ color: 'var(--muted-foreground)' }} />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{modulo.nombre}</p>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
              Este módulo no está incluido en tu plan actual. Contáctanos para activarlo.
            </p>
          </div>
          <a
            href={mailtoHref}
            className={`h-9 px-6 rounded-lg text-sm inline-flex items-center justify-center w-full max-w-xs ${FOCUS_RING}`}
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 600 }}
          >
            Contactar para activarlo
          </a>
          <button
            onClick={onClose}
            className={`text-xs text-muted-foreground hover:text-foreground transition-colors ${FOCUS_RING}`}
          >
            Cerrar
          </button>
        </div>
      </div>
    </BottomSheet>
  )
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

export function Home() {
  const { profile } = useAuthContext()
  const { theme, resolvedTheme, cycleTheme } = useTheme()
  const ThemeIcon = theme === 'dark' ? Moon : Sun
  const themeLabel = theme === 'dark' ? 'Oscuro' : 'Claro'
  const { orgNombre, orgPlan, metricas, recientes, loading, error } = useHomeDashboard()
  const { obligatoria } = useFirmaContext()

  // Registros propios sin firma (solo cuando firma obligatoria está activa)
  const [sinFirma, setSinFirma] = useState<{
    total: number
    modulos: { modulo: string; nombre: string; ruta: string; sin_firma: number }[]
  } | null>(null)
  useEffect(() => {
    if (!obligatoria || !profile?.id) { setSinFirma(null); return }
    let cancelado = false
    ;(supabase as any).rpc('mis_registros_sin_firma').then(({ data }: any) => {
      if (!cancelado && data) setSinFirma({ total: data.total ?? 0, modulos: data.modulos ?? [] })
    }).catch(() => {})
    return () => { cancelado = true }
  }, [obligatoria, profile?.id])
  const { resumen, loading: resumenLoading } = useDashboardResumen()
  const { items: correcciones, count: countCorrecciones } = useCorreccionesPendientes()
  const { resumen: agendaResumen } = useAgendaResumen()
  const {
    modulos, loading: loadingModulos, error: errorModulos,
    refetch: refetchModulos, terminosSitio,
  } = useModulosContext()
  const { busqueda, setBusqueda } = useHomeSearch()
  const reducedMotion = useReducedMotion()

  // Cascada de entrada — solo la primera vez que cada lista tiene datos
  // reales (no en interacciones posteriores como fijar/desfijar o filtrar).
  const primeraCargaModulosRef = useRef(true)
  const primeraCargaDashboardRef = useRef(true)
  useEffect(() => {
    if (!loadingModulos) primeraCargaModulosRef.current = false
  }, [loadingModulos])
  useEffect(() => {
    if (!loading) primeraCargaDashboardRef.current = false
  }, [loading])

  // Módulos fijados (accesos rápidos)
  // TODO: persistir por usuario — añadir columna `pinned_modules jsonb` a tabla `profiles`
  // y reemplazar useState por un hook que lea/escriba en Supabase.
  const [modulosFijados, setModulosFijados] = useState<string[]>([])

  // Módulo bloqueado seleccionado para el modal de upsell
  const [moduloBloqueadoUpsell, setModuloBloqueadoUpsell] = useState<ModuloVisible | null>(null)

  // Categoría abierta en popup
  const [categoriaAbierta, setCategoriaAbierta] = useState<string | null>(null)
  const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  // Ids fijados durante la sesión actual de la hoja abierta — al cerrarla,
  // sus tarjetas en Accesos rápidos se resaltan brevemente (ver `brillantes`).
  const recienFijadosRef = useRef<Set<string>>(new Set())
  const [brillantes, setBrillantes] = useState<Set<string>>(new Set())

  if (profile !== null && profile.rol === 'auditor') {
    return <Navigate to="/auditor" replace />
  }

  const esAdmin = profile?.rol === 'admin_org'
  const tieneAplicaciones = modulos.some(m => m.clave === 'aplicaciones')

  // Grupos por categoría temática — categorías y módulos dentro de cada una
  // en orden alfabético por su texto visible (ver CLAUDE.md: aprobado por
  // Saúl). CATEGORIA_MAP.orden se conserva intacto: lo siguen usando otras
  // partes de la app (Layout, header).
  const modulosAgrupados = useMemo(() => {
    const visibles = modulos.filter(m => m.mostrar_en_menu)
    const catMap = new Map<string, typeof modulos>()
    for (const m of visibles) {
      const cat = m.categoria ?? 'otros'
      if (!catMap.has(cat)) catMap.set(cat, [])
      catMap.get(cat)!.push(m)
    }
    const grupos = Array.from(catMap.entries()).map(([cat, mods]) => {
      const config = CATEGORIA_MAP[cat]
      return {
        key: cat,
        label: config?.label ?? 'Otros',
        icono: config?.icono ?? 'layout-grid',
        modulos: ordenarAlfabetico(mods, m => m.nombre),
      }
    })
    return ordenarAlfabetico(grupos, g => g.label)
  }, [modulos])

  // Limpiar búsqueda al desmontar
  useEffect(() => {
    return () => setBusqueda('')
  }, [setBusqueda])

  // Resultados de búsqueda en vivo — orden alfabético por nombre visible
  const modulosFiltrados = useMemo(() => {
    if (!busqueda.trim()) return []
    const q = busqueda.toLowerCase()
    const encontrados = modulos.filter(m => m.mostrar_en_menu && m.nombre.toLowerCase().includes(q))
    return ordenarAlfabetico(encontrados, m => m.nombre)
  }, [modulos, busqueda])

  // Objetos de módulos fijados
  const modulosFijadosObjs = useMemo(
    () =>
      modulosFijados
        .map(c => modulos.find(m => m.codigo === c))
        .filter(Boolean) as typeof modulos,
    [modulosFijados, modulos],
  )

  function toggleFijar(codigo: string) {
    setModulosFijados(prev => {
      const yaFijado = prev.includes(codigo)
      if (categoriaAbierta) {
        if (yaFijado) recienFijadosRef.current.delete(codigo)
        else recienFijadosRef.current.add(codigo)
      }
      return yaFijado
        ? prev.filter(c => c !== codigo)
        : prev.length >= MAX_PINNED
          ? prev
          : [...prev, codigo]
    })
  }

  function abrirCategoria(key: string) {
    setCategoriaAbierta(key)
  }

  function cerrarCategoria() {
    const key = categoriaAbierta
    setCategoriaAbierta(null)
    // Brillo en Accesos rápidos para lo recién fijado en esta hoja
    if (recienFijadosRef.current.size > 0) {
      const ids = new Set(recienFijadosRef.current)
      recienFijadosRef.current.clear()
      setBrillantes(ids)
      setTimeout(() => setBrillantes(new Set()), 1200)
    }
    // Restaurar foco al botón que abrió el popup
    setTimeout(() => {
      if (key) btnRefs.current.get(key)?.focus()
    }, 0)
  }

  function handleBloqueadoEnPopup(modulo: ModuloVisible) {
    setCategoriaAbierta(null)
    setModuloBloqueadoUpsell(modulo)
  }

  const nombreOrg = orgNombre ?? '—'
  const grupoAbierto = categoriaAbierta
    ? modulosAgrupados.find(g => g.key === categoriaAbierta) ?? null
    : null

  return (
    <div className="min-h-full pb-safe-nav md:pb-8">

      {/* Header — solo móvil */}
      <header className="md:hidden bg-card border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            aria-label="Ir al inicio"
            className="flex-shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <MadyLogo theme={resolvedTheme} className="h-8 w-auto" />
          </Link>
          <div className="text-right min-w-0 flex-1">
            <div className="text-sm text-foreground truncate" style={{ fontWeight: 600 }}>
              {loading ? '…' : `Hola, ${profile?.nombre_completo?.split(' ')[0] ?? '—'}`}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {loading ? '…' : nombreOrg}
            </div>
          </div>
          <button
            onClick={e => cycleTheme(e.currentTarget as HTMLElement)}
            className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring flex-shrink-0"
            aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
            title={themeLabel}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={theme}
                className="flex"
                initial={reducedMotion ? false : { rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={reducedMotion ? undefined : { rotate: 90, opacity: 0 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <ThemeIcon className="w-4 h-4" style={{ color: 'var(--muted-foreground)' }} />
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </header>

      <div className="p-4 space-y-5 md:px-6 md:py-5 lg:px-8 lg:py-6">

        {/* Banner cuenta pendiente */}
        {!loading && orgPlan === 'pendiente' && (
          <div
            className="flex items-start gap-3 rounded-xl p-4 border"
            style={{ backgroundColor: 'var(--agro-warning-fill)', borderColor: 'var(--agro-amber)' }}
          >
            <Clock3 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-warning-text)' }} />
            <div>
              <p className="text-sm" style={{ color: 'var(--agro-warning-text)', fontWeight: 600 }}>
                Tu cuenta está pendiente de activación
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--agro-warning-text)' }}>
                Si ya realizaste tu pago, en breve activaremos tu plan.{' '}
                <a
                  href="mailto:ventas@mady.com.mx"
                  className="underline"
                  style={{ color: 'var(--agro-warning-text)' }}
                >
                  ¿Dudas?
                </a>
              </p>
            </div>
          </div>
        )}

        {/* Banner firmas pendientes */}
        {sinFirma && sinFirma.total > 0 && (
          <div
            className="rounded-xl p-4 border space-y-2"
            style={{ backgroundColor: 'var(--agro-danger-fill)', borderColor: 'var(--agro-red)' }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--agro-danger-text)' }} />
              <p className="text-sm font-semibold" style={{ color: 'var(--agro-danger-text)' }}>
                Tienes {sinFirma.total} {sinFirma.total === 1 ? 'formato sin firmar' : 'formatos sin firmar'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {sinFirma.modulos.filter(m => m.sin_firma > 0).map(m => (
                <Link
                  key={m.modulo}
                  to={m.ruta}
                  className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg ${FOCUS_RING}`}
                  style={{
                    backgroundColor: 'rgba(153,60,29,0.12)',
                    color: 'var(--agro-danger-text)',
                    fontWeight: 600,
                  }}
                >
                  {m.nombre}
                  <span
                    className="ml-1 px-1 rounded-full text-[10px]"
                    style={{ backgroundColor: 'var(--agro-red)', color: 'white' }}
                  >
                    {m.sin_firma}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Error de carga */}
        {error && !loading && (
          <div
            className="flex items-start gap-2 rounded-xl p-3 border"
            style={{ backgroundColor: 'var(--agro-danger-fill)', borderColor: 'var(--agro-red)' }}
          >
            <TriangleAlert className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--agro-danger-text)' }} />
            <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
              Error al cargar el dashboard. Verifica tu conexión.
            </p>
          </div>
        )}

        {/* Buscador — móvil + tablet */}
        <div className="relative lg:hidden">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: 'var(--muted-foreground)' }}
          />
          <input
            type="search"
            placeholder="Buscar formato…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-lg text-sm outline-none transition-colors placeholder:text-muted-foreground"
            style={{
              backgroundColor: 'var(--input-background)',
              border: '1px solid var(--border)',
              color: 'var(--foreground)',
            }}
          />
        </div>

        {/* Resultados de búsqueda — chips aplanados */}
        {busqueda.trim() && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {modulosFiltrados.length === 0 ? (
              <p
                key={busqueda}
                className="text-sm text-muted-foreground px-4 py-3"
                style={searchCascadeStyle(0, !reducedMotion)}
              >
                Sin resultados para "{busqueda}"
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 p-3">
                {modulosFiltrados.map((modulo, index) => {
                  const Icon = resolverIcono(modulo.icono)
                  const bloqueado = !modulo.desbloqueado
                  if (bloqueado) {
                    return (
                      <button
                        key={modulo.codigo}
                        onClick={() => { setBusqueda(''); setModuloBloqueadoUpsell(modulo) }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border bg-[var(--agro-background)] border-[var(--border)] text-[var(--muted-foreground)] transition-colors duration-[var(--motion-fast)] hover:bg-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        style={{ opacity: 0.55, fontWeight: 500, ...searchCascadeStyle(index, !reducedMotion) }}
                      >
                        <Lock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                        {resaltarCoincidencia(modulo.nombre, busqueda)}
                      </button>
                    )
                  }
                  return (
                    <Link
                      key={modulo.codigo}
                      to={modulo.ruta}
                      onClick={() => setBusqueda('')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border bg-[var(--agro-background)] border-[var(--border)] text-[var(--foreground)] transition-colors duration-[var(--motion-fast)] hover:bg-[var(--accent)] hover:border-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      style={{ fontWeight: 500, ...searchCascadeStyle(index, !reducedMotion) }}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--primary)' }} />
                      {resaltarCoincidencia(modulo.nombre, busqueda)}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Correcciones pendientes */}
        {!loading && countCorrecciones > 0 && (
          <div
            className="rounded-xl overflow-hidden border"
            style={{ borderColor: 'var(--agro-amber)' }}
          >
            <div
              className="px-4 py-3 flex items-center gap-2"
              style={{ backgroundColor: 'var(--agro-warning-fill)' }}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--agro-warning-text)' }} />
              <span className="text-sm flex-1" style={{ color: 'var(--agro-warning-text)', fontWeight: 600 }}>
                {countCorrecciones}{' '}
                {countCorrecciones === 1 ? 'registro requiere' : 'registros requieren'} tu corrección
              </span>
            </div>
            <div className="bg-card divide-y divide-border">
              {correcciones.slice(0, 3).map(item => (
                <div key={`${item.tabla}-${item.id}`} className="px-4 py-3">
                  <p className="text-xs text-muted-foreground mb-0.5">
                    {item.moduloLabel} · {item.rancho_nombre}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                    {item.comentario_correccion ?? 'Revisa este registro'}
                  </p>
                </div>
              ))}
              {countCorrecciones > 3 && (
                <div className="px-4 py-2">
                  <p className="text-xs text-muted-foreground">+{countCorrecciones - 3} más</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Banner agenda de tareas */}
        {agendaResumen && !loading && (
          (esAdmin && (agendaResumen.por_verificar ?? 0) > 0) ||
          (!esAdmin && agendaResumen.mis_pendientes > 0)
        ) && (
          <Link
            to="/inocuidad/agenda"
            className={`hover-lift flex items-center gap-3 rounded-xl p-3 border ${FOCUS_RING}`}
            style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--agro-success-fill)' }}>
              <ListChecks className="w-4 h-4" style={{ color: 'var(--agro-success-text)' }} />
            </div>
            <div className="flex-1 min-w-0">
              {esAdmin ? (
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  {agendaResumen.por_verificar} {agendaResumen.por_verificar === 1 ? 'tarea' : 'tareas'} por verificar
                </p>
              ) : (
                <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                  Tienes {agendaResumen.mis_pendientes} {agendaResumen.mis_pendientes === 1 ? 'tarea pendiente' : 'tareas pendientes'}
                </p>
              )}
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Agenda de tareas</p>
            </div>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
          </Link>
        )}

        {/* ── Métricas ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {loadingModulos ? (
            [0, 1, 2, 3].map(i => (
              <div key={i} className="rounded-xl p-4 border border-border animate-pulse" style={{ backgroundColor: 'var(--agro-background)' }}>
                <div className="h-5 w-5 rounded mb-2" style={{ backgroundColor: 'var(--muted)' }} />
                <div className="h-2.5 rounded w-2/3" style={{ backgroundColor: 'var(--muted)' }} />
              </div>
            ))
          ) : tieneAplicaciones ? (
            <>
              <MetricCard loading={loading} value={String(metricas.appsMes)} numericValue={metricas.appsMes} format={(n) => String(Math.round(n))} reducedMotion={reducedMotion} label="Aplicaciones este mes" />
              <MetricCard loading={loading} value={String(metricas.productosDistintos)} numericValue={metricas.productosDistintos} format={(n) => String(Math.round(n))} reducedMotion={reducedMotion} label="Productos distintos" />
              <MetricCard loading={loading} value={formatDias(metricas.diasDesdeUltimaApp)} numericValue={metricas.diasDesdeUltimaApp} format={(n) => formatDias(Math.round(n))} reducedMotion={reducedMotion} label="Desde última aplicación" />
              <MetricCard loading={loading} value={`${formatHa(metricas.superficieHa)} ha`} numericValue={metricas.superficieHa} format={(n) => `${formatHa(n)} ha`} reducedMotion={reducedMotion} label="Superficie activa" />
            </>
          ) : (
            <>
              <MetricCard
                loading={resumenLoading}
                icon={<ClipboardList className="w-4 h-4 text-primary flex-shrink-0" />}
                value={String(resumen?.formatos_hoy ?? 0)}
                numericValue={resumen?.formatos_hoy ?? 0}
                format={(n) => String(Math.round(n))}
                reducedMotion={reducedMotion}
                label="Formatos llenados hoy"
              />
              <MetricCard
                loading={resumenLoading}
                icon={<BarChart2 className="w-4 h-4 text-primary flex-shrink-0" />}
                value={
                  resumen?.cumplimiento_promedio != null
                    ? `${Math.round(resumen.cumplimiento_promedio)}%`
                    : '—'
                }
                numericValue={resumen?.cumplimiento_promedio ?? null}
                format={(n) => `${Math.round(n)}%`}
                reducedMotion={reducedMotion}
                label="Cumplimiento promedio"
              />
              <MetricCard
                loading={resumenLoading}
                icon={<FileCheck className="w-4 h-4 text-primary flex-shrink-0" />}
                value={String(resumen?.formatos_mes ?? 0)}
                numericValue={resumen?.formatos_mes ?? 0}
                format={(n) => String(Math.round(n))}
                reducedMotion={reducedMotion}
                label="Formatos este mes"
              />
              <HallazgosCard loading={resumenLoading} value={resumen?.hallazgos_por_corregir ?? 0} reducedMotion={reducedMotion} />
            </>
          )}
        </div>

        {/* ── Dos columnas ─────────────────────────────────────────────────── */}
        <div className="md:grid md:grid-cols-[230px_1fr] md:gap-5 lg:grid-cols-[280px_1fr] lg:gap-6 md:items-start">

          {/* Columna izquierda: accesos rápidos + actividad */}
          <div className="space-y-5">

            {/* Accesos rápidos */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                  Accesos rápidos
                </h2>
                {modulosFijados.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {modulosFijados.length}/{MAX_PINNED}
                  </span>
                )}
              </div>

              {modulosFijadosObjs.length === 0 ? (
                <div
                  className="rounded-xl border border-dashed border-border p-5 text-center"
                  style={reducedMotion ? undefined : { animation: 'slideUpFade var(--motion-base) var(--ease-out) both' }}
                >
                  <Pin className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Fija los módulos que más usas. Toca el ícono de pin en cualquier módulo.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <AnimatePresence initial={false}>
                  {modulosFijadosObjs.map((modulo, index) => {
                    const Icon = resolverIcono(modulo.icono)
                    const bloqueado = !modulo.desbloqueado
                    const esCascadaInicial = !reducedMotion && primeraCargaModulosRef.current
                    const brillante = brillantes.has(modulo.codigo)
                    return (
                      <motion.div
                        key={modulo.codigo}
                        layout={!reducedMotion}
                        className="relative"
                        initial={
                          reducedMotion
                            ? false
                            : esCascadaInicial
                              ? { opacity: 0, y: 12 }
                              : { opacity: 0, scale: 0.96 }
                        }
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={reducedMotion ? undefined : { opacity: 0, scale: 0.96 }}
                        transition={
                          esCascadaInicial
                            ? { duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 7) * 0.035 }
                            : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
                        }
                      >
                        {bloqueado ? (
                          <button
                            onClick={() => setModuloBloqueadoUpsell(modulo)}
                            className={`w-full flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card transition-colors ${brillante ? 'pin-brillo' : ''} ${FOCUS_RING}`}
                            style={{ opacity: 0.55 }}
                          >
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center"
                              style={{ backgroundColor: 'var(--muted)' }}
                            >
                              <Icon className="w-5 h-5" style={{ color: 'var(--muted-foreground)' }} />
                            </div>
                            <span
                              className="text-xs text-center text-muted-foreground line-clamp-2 leading-snug"
                              style={{ fontWeight: 600 }}
                            >
                              {modulo.nombre}
                            </span>
                            <Lock className="w-3 h-3" style={{ color: 'var(--muted-foreground)' }} />
                          </button>
                        ) : (
                          <Link
                            to={modulo.ruta}
                            className={`hover-lift flex flex-col items-center gap-2 p-4 rounded-xl border border-border bg-card ${brillante ? 'pin-brillo' : ''} ${FOCUS_RING}`}
                          >
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center"
                              style={{ backgroundColor: 'var(--agro-success-fill)' }}
                            >
                              <Icon className="w-5 h-5" style={{ color: 'var(--agro-success-text)' }} />
                            </div>
                            <span
                              className="text-xs text-center text-foreground line-clamp-2 leading-snug"
                              style={{ fontWeight: 600 }}
                            >
                              {modulo.nombre}
                            </span>
                          </Link>
                        )}
                        <button
                          onClick={() => toggleFijar(modulo.codigo)}
                          className={`absolute top-1.5 right-1.5 w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ${FOCUS_RING}`}
                          aria-label="Quitar de accesos rápidos"
                          title="Quitar"
                        >
                          <span className="text-base leading-none select-none">×</span>
                        </button>
                      </motion.div>
                    )
                  })}
                  </AnimatePresence>
                </div>
              )}
            </section>

            {/* Acceso equipo — admin campo */}
            {esAdmin && !loading && terminosSitio.singular === 'Rancho' && (
              <Link
                to="/equipo/actividad"
                className={`hover-lift flex items-center gap-3 bg-card border border-border rounded-xl p-4 ${FOCUS_RING}`}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  <Users className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>
                    Actividad del equipo
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ver registros de todos los empleados
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              </Link>
            )}

            {/* Actividad reciente */}
            <section>
              <h2 className="mb-2 text-sm text-foreground" style={{ fontWeight: 600 }}>
                Actividad reciente
              </h2>

              {loading ? (
                <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                      <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--muted)' }} />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="h-3 rounded w-1/2" style={{ backgroundColor: 'var(--muted)' }} />
                        <div className="h-2.5 rounded w-1/4" style={{ backgroundColor: 'var(--muted)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recientes.length === 0 ? (
                <div
                  className="bg-card border border-border rounded-xl p-5 text-center"
                  style={reducedMotion ? undefined : { animation: 'slideUpFade var(--motion-base) var(--ease-out) both' }}
                >
                  <p className="text-sm text-muted-foreground" style={{ fontWeight: 600 }}>
                    Sin actividad aún
                  </p>
                  {tieneAplicaciones ? (
                    <>
                      <p className="text-xs text-muted-foreground mt-1">
                        Registra tu primer{' '}
                        {terminosSitio.singular.toLowerCase()} y crea una aplicación.
                      </p>
                      <Link
                        to="/nueva-aplicacion"
                        className={`inline-block mt-3 h-8 px-4 rounded-lg text-sm transition-colors ${FOCUS_RING}`}
                        style={{
                          lineHeight: '32px',
                          fontWeight: 600,
                          backgroundColor: 'var(--primary)',
                          color: 'var(--primary-foreground)',
                        }}
                      >
                        Nueva aplicación
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mt-1">
                        Registra tu primer formato para ver el historial aquí.
                      </p>
                      <Link
                        to="/historial"
                        className={`inline-block mt-3 h-8 px-4 rounded-lg text-sm transition-colors ${FOCUS_RING}`}
                        style={{
                          lineHeight: '32px',
                          fontWeight: 600,
                          backgroundColor: 'var(--primary)',
                          color: 'var(--primary-foreground)',
                        }}
                      >
                        Ver historial
                      </Link>
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                  {recientes.slice(0, 5).map((app, index) => {
                    const productosTexto =
                      app.productos.length === 0
                        ? 'Sin productos'
                        : app.productos.length === 1
                          ? app.productos[0]
                          : `${app.productos[0]} +${app.productos.length - 1}`
                    return (
                      <Link
                        key={app.id}
                        to={`/historial/${app.id}`}
                        className={`group flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors ${FOCUS_RING}`}
                        style={cascadeStyle(index, !reducedMotion && primeraCargaDashboardRef.current)}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: 'var(--accent)' }}
                        >
                          <FileCheck className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground truncate" style={{ fontWeight: 600 }}>
                            {productosTexto}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatFechaCorta(app.fecha)}</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform duration-[var(--motion-fast)] group-hover:translate-x-0.5" />
                      </Link>
                    )
                  })}
                  {recientes.length > 5 && (
                    <Link
                      to="/historial"
                      className={`flex items-center justify-center gap-1 py-3 text-xs text-muted-foreground hover:text-foreground transition-colors ${FOCUS_RING}`}
                    >
                      Ver todo el historial <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              )}
            </section>

          </div>{/* fin columna izquierda */}

          {/* Columna derecha: botones de categoría */}
          <div className="mt-5 md:mt-0">

            {loadingModulos ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <div
                    key={i}
                    className="rounded-xl p-3 border border-border animate-pulse flex flex-col items-center gap-2"
                    style={{ backgroundColor: 'var(--agro-background)' }}
                  >
                    <div className="w-9 h-9 rounded-lg" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-3 rounded w-3/4" style={{ backgroundColor: 'var(--muted)' }} />
                    <div className="h-4 rounded-full w-8" style={{ backgroundColor: 'var(--muted)' }} />
                  </div>
                ))}
              </div>
            ) : errorModulos ? (
              <div
                className="flex items-center gap-2 rounded-xl p-3 border"
                style={{ backgroundColor: 'var(--agro-danger-fill)', borderColor: 'var(--agro-red)' }}
              >
                <TriangleAlert className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--agro-danger-text)' }} />
                <p className="text-xs flex-1" style={{ color: 'var(--agro-danger-text)' }}>
                  Error al cargar módulos.{' '}
                  <button className={`underline ${FOCUS_RING}`} onClick={refetchModulos}>
                    Reintentar
                  </button>
                </p>
              </div>
            ) : modulosAgrupados.length === 0 ? null : (
              <>
                <h2 className="mb-2 text-sm text-foreground" style={{ fontWeight: 600 }}>
                  Inocuidad y BPAs
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {modulosAgrupados.map((grupo, index) => {
                    const GrupoIcon = resolverIcono(grupo.icono)
                    return (
                      <button
                        key={grupo.key}
                        ref={el => {
                          if (el) btnRefs.current.set(grupo.key, el)
                          else btnRefs.current.delete(grupo.key)
                        }}
                        onClick={() => abrirCategoria(grupo.key)}
                        className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border bg-card transition-all duration-[var(--motion-fast)] hover:-translate-y-[2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        style={cascadeStyle(index, !reducedMotion && primeraCargaModulosRef.current)}
                      >
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: 'var(--agro-success-fill)' }}
                        >
                          <GrupoIcon className="w-[18px] h-[18px]" style={{ color: 'var(--agro-success-text)' }} />
                        </div>
                        <span
                          className="text-xs text-center text-foreground line-clamp-2 leading-snug w-full"
                          style={{ fontWeight: 600 }}
                        >
                          {grupo.label}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: 'var(--agro-success-fill)',
                            color: 'var(--agro-success-text)',
                            fontWeight: 600,
                          }}
                        >
                          {grupo.modulos.length}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}

          </div>{/* fin columna derecha */}

        </div>{/* fin dos columnas */}

      </div>

      {/* Popup de categoría */}
      {grupoAbierto && (
        <CategoriaPopup
          grupo={grupoAbierto}
          modulosFijados={modulosFijados}
          toggleFijar={toggleFijar}
          onClose={cerrarCategoria}
          onBloqueado={handleBloqueadoEnPopup}
        />
      )}

      {/* Modal de upsell para módulos bloqueados */}
      <UpsellModal
        modulo={moduloBloqueadoUpsell}
        onClose={() => setModuloBloqueadoUpsell(null)}
      />
    </div>
  )
}
