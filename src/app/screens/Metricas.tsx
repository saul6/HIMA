import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { BarChart3, ChevronDown, AlertTriangle, CheckCircle2, AlertCircle, XCircle, CircleDashed, Clock, TrendingUp } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useMetricas } from '@/hooks/useMetricas'
import { useContadorAnimado } from '@/hooks/useContadorAnimado'
import { hoyMX } from '@/lib/fecha'
import { SPRING_SUAVE, SPRING_SUAVE_SIN_REBOTE } from '@/lib/motion'
import type {
  MetProductividad,
  MetAgenda,
  MetCumplimiento,
  MetConstancia,
  MetCampo,
  ColaboradorProductividad,
  AuditoriaInterna,
  InternaResumen,
} from '@/hooks/useMetricas'
import { bandaCumplimiento, type BandaCumplimiento } from '@/lib/metricas/bandaCumplimiento'

// Mismo timing/curva que el resto de la app (ver NuevaAplicacion.tsx) — constante
// local para no repetir el array de easing en cada transición de este archivo.
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1]
const TAB_TRANSITION = { duration: 0.22, ease: EASE_OUT }

// ── Helpers de fechas ────────────────────────────────────────────────────────

type PeriodoKey = 'este_mes' | 'mes_anterior' | 'ultimos_3' | 'este_anio' | 'personalizado'

function calcularPeriodo(key: PeriodoKey): { desde: string; hasta: string } {
  const hoy = hoyMX()
  const [anio, mes] = hoy.split('-').map(Number)
  if (key === 'este_mes') {
    const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`
    return { desde: inicio, hasta: hoy }
  }
  if (key === 'mes_anterior') {
    const mesAnt = mes === 1 ? 12 : mes - 1
    const anioAnt = mes === 1 ? anio - 1 : anio
    const inicio = `${anioAnt}-${String(mesAnt).padStart(2, '0')}-01`
    const ultimo = new Date(anio, mes - 1, 0).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
    return { desde: inicio, hasta: ultimo }
  }
  if (key === 'ultimos_3') {
    const d = new Date()
    d.setMonth(d.getMonth() - 3)
    const desde = d.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
    return { desde, hasta: hoy }
  }
  if (key === 'este_anio') {
    return { desde: `${anio}-01-01`, hasta: hoy }
  }
  return { desde: hoy, hasta: hoy }
}

const PERIODOS: { key: PeriodoKey; label: string }[] = [
  { key: 'este_mes', label: 'Este mes' },
  { key: 'mes_anterior', label: 'Mes anterior' },
  { key: 'ultimos_3', label: 'Últimos 3 meses' },
  { key: 'este_anio', label: 'Este año' },
  { key: 'personalizado', label: 'Personalizado' },
]

const ROL_LABELS: Record<string, string> = {
  admin_org: 'Admin', super_admin: 'Super Admin',
  asesor_tecnico: 'Asesor', operario: 'Operario', auditor: 'Auditor',
}

// ── Chip de estado ────────────────────────────────────────────────────────────

function ChipPct({ pct }: { pct: number }) {
  let color = 'var(--agro-success-text)'
  let bg = 'var(--agro-success-fill)'
  if (pct < 70) { color = 'var(--agro-danger-text)'; bg = 'var(--agro-danger-fill)' }
  else if (pct < 90) { color = 'var(--agro-warning-text)'; bg = 'var(--agro-warning-fill)' }
  return (
    <span className="text-xs px-1.5 py-0.5 rounded-md tabular-nums" style={{ color, backgroundColor: bg }}>
      {pct.toFixed(0)}%
    </span>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-md animate-pulse ${className}`}
      style={{ backgroundColor: 'var(--muted)' }}
    />
  )
}

function TabSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}

// ── Vacío ─────────────────────────────────────────────────────────────────────

function Vacio({ mensaje = 'Sin datos en este periodo' }: { mensaje?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <BarChart3 className="w-10 h-10" style={{ color: 'var(--muted-foreground)' }} />
      <p className="text-sm text-muted-foreground">{mensaje}</p>
    </div>
  )
}

// ── Contador animado (mismo patrón que Home.tsx `AnimatedNumber`) ────────────

function AnimatedNumber({
  value, format, reducedMotion,
}: { value: number | null; format: (n: number) => string; reducedMotion: boolean }) {
  const spanRef = useContadorAnimado(value, format, reducedMotion)
  return <span ref={spanRef}>{value === null ? '—' : format(value)}</span>
}

// ── Entrada escalonada reutilizable (tarjetas y filas de listas) ─────────────

function EntradaEscalonada({
  index, reducedMotion, children, className, style,
}: {
  index: number
  reducedMotion: boolean
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <motion.div
      className={className}
      style={style}
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.22, ease: EASE_OUT, delay: Math.min(index * 0.04, 0.4) }}
    >
      {children}
    </motion.div>
  )
}

// ── Tarjeta resumen ───────────────────────────────────────────────────────────

function TarjetaResumen({ label, valor, sub }: { label: string; valor: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl p-4 border border-border bg-card flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl tabular-nums" style={{ color: 'var(--foreground)', fontWeight: 700 }}>
        {valor}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ── Pestaña Productividad ─────────────────────────────────────────────────────

function TabProductividad({
  datos,
  modulos,
  esAdmin,
}: {
  datos: MetProductividad
  modulos: { codigo: string; nombre: string }[]
  esAdmin: boolean
}) {
  const [expandido, setExpandido] = useState<string | null>(null)

  const reducedMotion = useReducedMotion()
  const colaboradores = datos.colaboradores ?? []
  if (colaboradores.length === 0) return <Vacio />

  const maxCapturas = Math.max(...colaboradores.map(c => c.capturas), 1)
  const totalCol = datos.total_colaboradores ?? colaboradores.length
  const v = datos.verificacion

  // Totales para tarjetas admin
  const totalCapturas = colaboradores.reduce((s, c) => s + c.capturas, 0)
  const totalCorrecciones = colaboradores.reduce((s, c) => s + (c.correcciones ?? 0), 0)
  const pctCorreccion = totalCapturas > 0 ? (totalCorrecciones / totalCapturas) * 100 : 0
  const colConCapturas = datos.colaboradores_con_capturas ?? colaboradores.filter(c => c.capturas > 0).length

  // Datos propios para tarjetas no-admin
  const mr = datos.mi_resumen
  const miPosicion = colaboradores.find(c => c.es_yo)?.posicion

  return (
    <div className="space-y-4 pb-8">
      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 gap-3 px-4 pt-4">
        {esAdmin ? (
          <>
            <EntradaEscalonada index={0} reducedMotion={reducedMotion}>
              <TarjetaResumen
                label="Total capturas"
                valor={<AnimatedNumber value={totalCapturas} format={n => Math.round(n).toLocaleString('es-MX')} reducedMotion={reducedMotion} />}
              />
            </EntradaEscalonada>
            <EntradaEscalonada index={1} reducedMotion={reducedMotion}>
              <TarjetaResumen
                label="Colaboradores con capturas"
                valor={<>
                  <AnimatedNumber value={colConCapturas} format={n => String(Math.round(n))} reducedMotion={reducedMotion} /> de{' '}
                  <AnimatedNumber value={totalCol} format={n => String(Math.round(n))} reducedMotion={reducedMotion} />
                </>}
              />
            </EntradaEscalonada>
            <EntradaEscalonada index={2} reducedMotion={reducedMotion}>
              <TarjetaResumen
                label="Con corrección"
                valor={<AnimatedNumber value={pctCorreccion} format={n => `${n.toFixed(1)}%`} reducedMotion={reducedMotion} />}
                sub={`${totalCorrecciones} registros`}
              />
            </EntradaEscalonada>
          </>
        ) : (
          <>
            <EntradaEscalonada index={0} reducedMotion={reducedMotion}>
              <TarjetaResumen
                label="Mis capturas"
                valor={<AnimatedNumber value={mr?.capturas ?? 0} format={n => Math.round(n).toLocaleString('es-MX')} reducedMotion={reducedMotion} />}
              />
            </EntradaEscalonada>
            <EntradaEscalonada index={1} reducedMotion={reducedMotion}>
              <TarjetaResumen
                label="Mi posición"
                valor={miPosicion != null ? (
                  <>
                    #<AnimatedNumber value={miPosicion} format={n => String(Math.round(n))} reducedMotion={reducedMotion} /> de{' '}
                    <AnimatedNumber value={totalCol} format={n => String(Math.round(n))} reducedMotion={reducedMotion} />
                  </>
                ) : '—'}
              />
            </EntradaEscalonada>
            <EntradaEscalonada index={2} reducedMotion={reducedMotion}>
              <TarjetaResumen
                label="Con corrección"
                valor={mr?.pct_correccion != null ? (
                  <AnimatedNumber value={mr.pct_correccion} format={n => `${n.toFixed(1)}%`} reducedMotion={reducedMotion} />
                ) : '—'}
              />
            </EntradaEscalonada>
          </>
        )}
        {v && (
          <EntradaEscalonada index={3} reducedMotion={reducedMotion}>
            <TarjetaResumen
              label="Verificados"
              valor={<AnimatedNumber value={v.verificados} format={n => Math.round(n).toLocaleString('es-MX')} reducedMotion={reducedMotion} />}
              sub={`${v.pendientes_verificar} pendientes${v.horas_promedio != null ? ` · ${v.horas_promedio.toFixed(1)} h prom.` : ''}`}
            />
          </EntradaEscalonada>
        )}
      </div>

      {/* Ranking */}
      <div className="px-4">
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted-foreground)' }}>
          RANKING DE COLABORADORES
        </p>
        <div className="space-y-2">
          {colaboradores.map((c: ColaboradorProductividad, i: number) => {
            const tieneDetalle = c.detalle_visible
            const tieneDesglose = tieneDetalle && c.por_modulo != null && Object.keys(c.por_modulo).length > 0
            const abierto = expandido === c.profile_id && tieneDesglose
            const pct = (c.capturas / maxCapturas) * 100
            const porModuloEntries = tieneDesglose
              ? Object.entries(c.por_modulo!).sort((a, b) => b[1] - a[1])
              : []
            // Entrada escalonada solo en las primeras 10 filas; de ahí en
            // adelante (y con prefers-reduced-motion) aparecen directo.
            const animarEntrada = !reducedMotion && i < 10
            const delayFila = animarEntrada ? Math.min(i * 0.04, 0.4) : 0

            // Posición — acento para los 3 primeros con capturas > 0
            const esPodio = c.capturas > 0 && c.posicion <= 3
            let posBg = 'transparent'
            let posColor = 'var(--muted-foreground)'
            if (esPodio) {
              if (c.posicion === 1) { posBg = 'var(--primary)'; posColor = '#fff' }
              else if (c.posicion === 2) { posBg = 'var(--agro-warning-fill)'; posColor = 'var(--agro-warning-text)' }
              else { posBg = 'var(--muted)'; posColor = 'var(--foreground)' }
            }

            const rowInner = (
              <div className="flex items-start gap-2">
                {/* Posición — "pop" leve al entrar */}
                <motion.span
                  className="text-xs tabular-nums font-bold px-1.5 py-0.5 rounded-md flex-shrink-0 text-center mt-0.5"
                  style={{ backgroundColor: posBg, color: posColor, minWidth: '2rem' }}
                  initial={animarEntrada ? { opacity: 0, scale: 0.6 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={animarEntrada ? { ...SPRING_SUAVE, delay: delayFila } : { duration: 0 }}
                >
                  #{c.posicion}
                </motion.span>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="min-w-0 flex items-baseline gap-1.5 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                        {c.nombre}
                      </span>
                      {c.es_yo && (
                        <span
                          className="text-xs font-semibold px-1 py-0.5 rounded"
                          style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
                        >
                          Tú
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {ROL_LABELS[c.rol] ?? c.rol}
                      </span>
                      {!c.activo && (
                        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          Inactivo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-sm tabular-nums font-semibold" style={{ color: 'var(--primary)' }}>
                        <AnimatedNumber value={c.capturas} format={n => Math.round(n).toLocaleString('es-MX')} reducedMotion={reducedMotion} />
                      </span>
                      {tieneDesglose && (
                        <ChevronDown
                          className="w-4 h-4 text-muted-foreground transition-transform"
                          style={{ transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)', transitionDuration: 'var(--motion-fast)' }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Barra horizontal */}
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--muted)' }}>
                    <motion.div
                      className="h-full rounded-full origin-left"
                      style={{ backgroundColor: 'var(--primary)' }}
                      initial={reducedMotion ? false : { scaleX: 0 }}
                      animate={{ scaleX: pct / 100 }}
                      transition={reducedMotion ? { duration: 0 } : { ...SPRING_SUAVE_SIN_REBOTE, delay: animarEntrada ? delayFila + 0.1 : 0 }}
                    />
                  </div>

                  {/* Detalles — solo si visible */}
                  {tieneDetalle && (
                    <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground">
                      {c.capturas > 0 ? (
                        <>
                          <span>
                            {(c.correcciones ?? 0) > 0
                              ? `${(c.pct_correccion ?? 0).toFixed(1)}% corrección`
                              : 'Sin correcciones'}
                          </span>
                          {(c.sin_firma ?? 0) > 0 && (
                            <span style={{ color: 'var(--agro-warning-text)' }}>
                              {c.sin_firma} sin firma
                            </span>
                          )}
                        </>
                      ) : (
                        <span>Sin capturas en este periodo</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )

            return (
              <motion.div
                key={c.profile_id}
                layout
                initial={animarEntrada ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: c.activo ? 1 : 0.6, y: 0 }}
                transition={animarEntrada ? { duration: 0.22, ease: EASE_OUT, delay: delayFila } : { duration: 0 }}
                className="rounded-xl border border-border overflow-hidden"
                style={{ backgroundColor: c.es_yo ? 'var(--agro-success-fill)' : 'var(--card)' }}
              >
                {tieneDesglose ? (
                  <button
                    className="w-full text-left px-4 py-3 transition-colors hover:bg-muted"
                    style={{ transitionDuration: 'var(--motion-fast)' }}
                    onClick={() => setExpandido(abierto ? null : c.profile_id)}
                    aria-expanded={abierto}
                  >
                    {rowInner}
                  </button>
                ) : (
                  <div className="px-4 py-3">{rowInner}</div>
                )}

                {/* Desglose por módulo — mismo patrón de desplegable (accordion-rows) */}
                {tieneDesglose && (
                  <div className={`accordion-rows ${abierto ? 'is-open' : ''}`}>
                    <div>
                      <div
                        className="px-4 pb-3 pt-0 border-t border-border"
                        style={{ backgroundColor: 'var(--muted)' }}
                      >
                        <p className="text-xs font-semibold mt-2 mb-2" style={{ color: 'var(--muted-foreground)' }}>
                          DESGLOSE POR MÓDULO
                        </p>
                        <div className="space-y-1">
                          {porModuloEntries.map(([codigo, n]) => {
                            const mod = modulos.find(m => m.codigo === codigo)
                            return (
                              <div key={codigo} className="flex items-center justify-between text-sm">
                                <span style={{ color: 'var(--foreground)' }}>
                                  {mod ? mod.nombre : codigo}
                                </span>
                                <span className="tabular-nums" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                                  {(n as number).toLocaleString('es-MX')}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Pestaña Agenda ────────────────────────────────────────────────────────────

function TabAgenda({ datos }: { datos: MetAgenda }) {
  const reducedMotion = useReducedMotion()
  const colaboradores = datos.colaboradores ?? []
  if (colaboradores.length === 0) return <Vacio />

  return (
    <div className="space-y-3 px-4 pt-4 pb-8">
      {colaboradores.map((c, i) => {
        const pctATiempo = c.cerradas > 0 ? (c.a_tiempo / c.cerradas) * 100 : null
        return (
          <EntradaEscalonada key={c.profile_id} index={i} reducedMotion={reducedMotion} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>{c.nombre}</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Asignadas</p>
                <p className="tabular-nums font-semibold" style={{ color: 'var(--foreground)' }}>
                  <AnimatedNumber value={c.asignadas} format={n => String(Math.round(n))} reducedMotion={reducedMotion} />
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cerradas</p>
                <p className="tabular-nums font-semibold" style={{ color: 'var(--foreground)' }}>
                  <AnimatedNumber value={c.cerradas} format={n => String(Math.round(n))} reducedMotion={reducedMotion} />
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">% a tiempo</p>
                {pctATiempo != null
                  ? <ChipPct pct={pctATiempo} />
                  : <span className="text-xs text-muted-foreground">—</span>}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vencidas</p>
                <p
                  className="tabular-nums font-semibold"
                  style={{ color: c.vencidas_abiertas > 0 ? 'var(--agro-danger-text)' : 'var(--foreground)' }}
                >
                  <AnimatedNumber value={c.vencidas_abiertas} format={n => String(Math.round(n))} reducedMotion={reducedMotion} />
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Regresadas</p>
                <p className="tabular-nums font-semibold" style={{ color: 'var(--foreground)' }}>
                  <AnimatedNumber value={c.regresadas} format={n => String(Math.round(n))} reducedMotion={reducedMotion} />
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Días prom.</p>
                <p className="tabular-nums font-semibold" style={{ color: 'var(--foreground)' }}>
                  {c.dias_promedio_cierre != null
                    ? <AnimatedNumber value={c.dias_promedio_cierre} format={n => n.toFixed(1)} reducedMotion={reducedMotion} />
                    : '—'}
                </p>
              </div>
            </div>
          </EntradaEscalonada>
        )
      })}
    </div>
  )
}

// ── Gráfica de barras por mes (reutilizable) ─────────────────────────────────

function GraficaBarrasMes({
  series,
  meses,
  ariaLabel,
}: {
  series: { label: string; color: string; valores: number[] }[]
  meses: string[]
  ariaLabel: string
}) {
  const cruzaAnio = new Set(meses.map(m => m.slice(0, 4))).size > 1
  const todosValores = series.flatMap(s => s.valores)
  const maxVal = Math.max(...todosValores, 1)
  const ALTO = 72
  const BAR_W = 22
  const OVERHEAD = 20
  const scrollable = meses.length > 8
  const reducedMotion = useReducedMotion()

  const etiqueta = (mes: string) => {
    const nombres = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
    const [anio, m] = mes.split('-')
    const nombre = nombres[parseInt(m) - 1]
    return cruzaAnio ? `${nombre} ${anio.slice(2)}` : nombre
  }

  const groupMinW = series.length * (BAR_W + 4) + 8

  return (
    <div>
      {series.length > 1 && (
        <div className="flex items-center gap-4 mb-3 flex-wrap">
          {series.map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      )}
      <div
        role="img"
        aria-label={ariaLabel}
        className={scrollable ? 'overflow-x-auto' : ''}
      >
        <div
          className="flex gap-2"
          style={{ minWidth: scrollable ? `${meses.length * (groupMinW + 8)}px` : undefined }}
        >
          {meses.map((mes, mi) => (
            <div
              key={mes}
              className="flex flex-col items-center"
              style={{
                flex: scrollable ? 'none' : '1',
                minWidth: scrollable ? `${groupMinW}px` : undefined,
              }}
            >
              <div className="flex gap-1" style={{ height: `${ALTO + OVERHEAD}px` }}>
                {series.map((s, si) => {
                  const val = s.valores[mi] ?? 0
                  const ratio = val / maxVal
                  return (
                    <div
                      key={si}
                      className="relative flex-shrink-0"
                      style={{ width: `${BAR_W}px`, height: `${ALTO + OVERHEAD}px` }}
                    >
                      <span
                        className="absolute text-[10px] tabular-nums text-center w-full"
                        style={{
                          color: 'var(--muted-foreground)',
                          bottom: `${Math.round(ALTO * ratio) + 2}px`,
                        }}
                      >
                        {val}
                      </span>
                      <motion.div
                        className="absolute bottom-0 w-full rounded-sm"
                        style={{
                          height: `${ALTO}px`,
                          backgroundColor: val > 0 ? s.color : 'transparent',
                          transformOrigin: 'bottom',
                        }}
                        initial={reducedMotion ? false : { scaleY: 0 }}
                        animate={{ scaleY: ratio }}
                        transition={reducedMotion ? { duration: 0 } : { ...SPRING_SUAVE_SIN_REBOTE, delay: Math.min(mi * 0.03, 0.3) }}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="w-full h-px" style={{ backgroundColor: 'var(--border)' }} />
              <span className="text-[10px] text-muted-foreground text-center mt-1">
                {etiqueta(mes)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Helpers de auditorías internas ────────────────────────────────────────────

function formatFechaAuditoria(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-')
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${parseInt(dia)} ${meses[parseInt(mes) - 1]} ${anio}`
}

function estilosBanda(banda: BandaCumplimiento): { color: string; bg: string } {
  switch (banda) {
    case 'aprobatoria':  return { color: 'var(--agro-success-text)', bg: 'var(--agro-success-fill)' }
    case 'parcial':      return { color: 'var(--agro-warning-text)', bg: 'var(--agro-warning-fill)' }
    case 'reprobatoria': return { color: 'var(--agro-danger-text)',  bg: 'var(--agro-danger-fill)' }
    case 'sin_puntaje':  return { color: 'var(--muted-foreground)',   bg: 'var(--muted)' }
  }
}

const BANDA_CONFIG: Record<BandaCumplimiento, {
  label: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: any
  defaultOpen: boolean
  nota?: string
}> = {
  aprobatoria:  { label: 'Aprobatorias',  Icon: CheckCircle2, defaultOpen: true },
  parcial:      { label: 'Parciales',     Icon: AlertCircle,  defaultOpen: true },
  reprobatoria: { label: 'Reprobatorias', Icon: XCircle,      defaultOpen: true },
  sin_puntaje:  { label: 'Sin puntaje',   Icon: CircleDashed, defaultOpen: false, nota: '0 puntos posibles, no cuentan en el promedio' },
}

function GrupoAuditoriasInternas({
  banda,
  auditorias,
}: {
  banda: BandaCumplimiento
  auditorias: AuditoriaInterna[]
}) {
  const cfg = BANDA_CONFIG[banda]
  const { color, bg } = estilosBanda(banda)
  const [abierto, setAbierto] = useState(cfg.defaultOpen)
  const reducedMotion = useReducedMotion()

  const sorted = [...auditorias].sort((a, b) => {
    if (b.porcentaje !== a.porcentaje) return b.porcentaje - a.porcentaje
    return b.fecha.localeCompare(a.fecha)
  })

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        style={{ backgroundColor: 'var(--card)' }}
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
      >
        <cfg.Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
        <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {cfg.label}
        </span>
        <span
          className="text-xs tabular-nums px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
          style={{ color, backgroundColor: bg }}
        >
          {auditorias.length}
        </span>
        <ChevronDown
          className="w-4 h-4 flex-shrink-0 transition-transform"
          style={{
            color: 'var(--muted-foreground)',
            transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)',
            transitionDuration: 'var(--motion-fast)',
          }}
        />
      </button>

      <div className={`accordion-rows ${abierto ? 'is-open' : ''}`}>
        <div>
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {cfg.nota && (
              <p className="px-4 py-2 text-xs" style={{ color: 'var(--muted-foreground)', backgroundColor: 'var(--muted)' }}>
                {cfg.nota}
              </p>
            )}
            {sorted.map((a, i) => {
              const b = bandaCumplimiento(a.porcentaje, a.posibles)
              const { color: bc, bg: bbg } = estilosBanda(b)
              return (
                <EntradaEscalonada
                  key={i}
                  index={i}
                  reducedMotion={reducedMotion}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{ backgroundColor: 'var(--card)' }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{a.nombre}</p>
                    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                      {a.rancho} · {formatFechaAuditoria(a.fecha)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {a.posibles > 0 ? (
                      <>
                        <span
                          className="text-sm tabular-nums font-semibold px-2 py-0.5 rounded-md"
                          style={{ color: bc, backgroundColor: bbg }}
                        >
                          {a.porcentaje.toFixed(1)}%
                        </span>
                        <p className="text-xs tabular-nums mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          {a.puntos}/{a.posibles} pts
                        </p>
                      </>
                    ) : (
                      <span className="text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>0/0 pts</span>
                    )}
                  </div>
                </EntradaEscalonada>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Pestaña Cumplimiento ──────────────────────────────────────────────────────

function TabCumplimiento({ datos }: { datos: MetCumplimiento }) {
  const reducedMotion = useReducedMotion()
  const internas = datos.internas ?? []
  const externas = datos.externas ?? []
  const fallas = datos.fallas_recurrentes ?? []
  const porMes = datos.incidencias?.por_mes ?? []

  if (internas.length === 0 && externas.length === 0 && fallas.length === 0) {
    return <Vacio />
  }

  return (
    <div className="space-y-6 px-4 pt-4 pb-8">
      {/* Auditorías internas */}
      {internas.length > 0 && (
        <section>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>
            AUDITORÍAS INTERNAS
          </p>

          {/* Tarjetas de promedio por módulo */}
          {datos.internas_resumen && datos.internas_resumen.length > 0 && (() => {
            const resumen = datos.internas_resumen!
            return (
              <>
                <div
                  className="gap-3 mb-3"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
                >
                  {resumen.map((r, i) => {
                    const banda = r.promedio != null
                      ? bandaCumplimiento(r.promedio, r.con_puntaje > 0 ? 1 : 0)
                      : 'sin_puntaje'
                    const { color, bg } = estilosBanda(banda)
                    return (
                      <EntradaEscalonada
                        key={r.modulo}
                        index={i}
                        reducedMotion={reducedMotion}
                        className="rounded-xl border border-border bg-card p-3 flex flex-col gap-1.5"
                      >
                        <p
                          className="text-xs line-clamp-2"
                          style={{ color: 'var(--muted-foreground)' }}
                          title={r.nombre}
                        >
                          {r.nombre}
                        </p>
                        <span
                          className="text-2xl tabular-nums font-bold self-start px-2 py-0.5 rounded-lg"
                          style={{ color, backgroundColor: bg }}
                        >
                          {r.promedio != null
                            ? <AnimatedNumber value={r.promedio} format={n => `${n.toFixed(1)}%`} reducedMotion={reducedMotion} />
                            : '—'}
                        </span>
                        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
                          {r.auditorias} auditoría{r.auditorias !== 1 ? 's' : ''}
                          {r.sin_puntaje > 0 && ` · ${r.sin_puntaje} sin puntaje`}
                        </p>
                      </EntradaEscalonada>
                    )
                  })}
                </div>

                {/* Leyenda */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
                  {(['aprobatoria', 'parcial', 'reprobatoria'] as BandaCumplimiento[]).map(b => {
                    const { color, bg } = estilosBanda(b)
                    const labels: Record<string, string> = {
                      aprobatoria: 'Aprobatoria ≥ 80%',
                      parcial: 'Parcial 70–79%',
                      reprobatoria: 'Reprobatoria < 70%',
                    }
                    return (
                      <span key={b} className="flex items-center gap-1.5 text-xs" style={{ color }}>
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: bg }} />
                        {labels[b]}
                      </span>
                    )
                  })}
                </div>
              </>
            )
          })()}

          {/* Grupos por banda */}
          {(() => {
            const porBanda: Record<BandaCumplimiento, AuditoriaInterna[]> = {
              aprobatoria: [], parcial: [], reprobatoria: [], sin_puntaje: [],
            }
            internas.forEach(a => {
              porBanda[bandaCumplimiento(a.porcentaje, a.posibles)].push(a)
            })
            const bandas: BandaCumplimiento[] = ['aprobatoria', 'parcial', 'reprobatoria', 'sin_puntaje']
            return (
              <div className="space-y-2">
                {bandas.map(b => porBanda[b].length > 0 && (
                  <GrupoAuditoriasInternas key={b} banda={b} auditorias={porBanda[b]} />
                ))}
              </div>
            )
          })()}
        </section>
      )}

      {/* Auditorías externas */}
      {externas.length > 0 && (
        <section>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>
            AUDITORÍAS EXTERNAS
          </p>
          <div className="space-y-2">
            {externas.map((a, i) => (
              <EntradaEscalonada key={i} index={i} reducedMotion={reducedMotion} className="rounded-xl border border-border bg-card p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{a.fecha}</p>
                  <span className="text-xs px-2 py-0.5 rounded-md" style={{
                    backgroundColor: a.resultado === 'aprobado' ? 'var(--agro-success-fill)' : 'var(--agro-danger-fill)',
                    color: a.resultado === 'aprobado' ? 'var(--agro-success-text)' : 'var(--agro-danger-text)',
                  }}>
                    {a.resultado}
                  </span>
                </div>
                {a.falla_automatica && (
                  <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
                    ⚠ Falla automática
                  </p>
                )}
                {a.nc_abiertas > 0 && (
                  <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                    {a.nc_abiertas} NC{a.nc_abiertas > 1 ? 's' : ''} abiertas
                  </p>
                )}
              </EntradaEscalonada>
            ))}
          </div>
        </section>
      )}

      {/* Incidencias M13 por mes */}
      {datos.incidencias && porMes.length > 0 && (
        <section>
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--muted-foreground)' }}>
            INCIDENCIAS M13 POR MES
          </p>
          {porMes.length <= 1 ? (
            <div className="space-y-2 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <EntradaEscalonada index={0} reducedMotion={reducedMotion}>
                  <TarjetaResumen
                    label="Reportes"
                    valor={<AnimatedNumber value={datos.incidencias.reportes} format={n => Math.round(n).toLocaleString('es-MX')} reducedMotion={reducedMotion} />}
                  />
                </EntradaEscalonada>
                <EntradaEscalonada index={1} reducedMotion={reducedMotion}>
                  <TarjetaResumen
                    label="Incidencias"
                    valor={<AnimatedNumber value={datos.incidencias.incidencias} format={n => Math.round(n).toLocaleString('es-MX')} reducedMotion={reducedMotion} />}
                  />
                </EntradaEscalonada>
              </div>
              <p className="text-xs text-muted-foreground">Un reporte puede tener varias incidencias</p>
            </div>
          ) : (
            <div className="mt-3">
              <GraficaBarrasMes
                series={[
                  { label: 'Reportes', color: 'var(--primary)', valores: porMes.map(p => p.reportes) },
                  { label: 'Incidencias', color: 'var(--secondary)', valores: porMes.map(p => p.incidencias) },
                ]}
                meses={porMes.map(p => p.mes)}
                ariaLabel={porMes.map(p => {
                  const mo = parseInt(p.mes.split('-')[1]) - 1
                  const ns = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
                  return `${ns[mo]}: ${p.reportes} reportes, ${p.incidencias} incidencias`
                }).join('; ')}
              />
            </div>
          )}
        </section>
      )}

      {/* Fallas recurrentes */}
      {fallas.length > 0 && (
        <section>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>
            PUNTOS DE FALLA RECURRENTES (TOP {fallas.length})
          </p>
          <div className="space-y-1.5">
            {fallas.map((f, i) => (
              <EntradaEscalonada key={i} index={i} reducedMotion={reducedMotion} className="flex items-start justify-between gap-3 py-1.5 border-b border-border last:border-0">
                <div className="min-w-0">
                  <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    {f.modulo}
                  </span>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>{f.punto}</p>
                </div>
                <span className="text-sm tabular-nums flex-shrink-0 font-semibold" style={{ color: 'var(--agro-danger-text)' }}>
                  ×<AnimatedNumber value={f.veces} format={n => String(Math.round(n))} reducedMotion={reducedMotion} />
                </span>
              </EntradaEscalonada>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Pestaña Constancia ────────────────────────────────────────────────────────

function formatFechaCorta(fecha: string): string {
  const [, mes, dia] = fecha.split('-')
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  return `${parseInt(dia)} ${meses[parseInt(mes) - 1]}`
}

function TabConstancia({ datos }: { datos: MetConstancia }) {
  const reducedMotion = useReducedMotion()
  const modulos = datos.modulos ?? []
  if (modulos.length === 0) return (
    <Vacio mensaje="Sin módulos con frecuencia fija en este periodo" />
  )

  return (
    <div className="px-4 pt-4 pb-8 space-y-4">
      <div className="space-y-2">
        {modulos.map((m, i) => {
          const huecos = m.huecos_recientes ?? []
          return (
            <EntradaEscalonada
              key={`${m.modulo}-${m.rancho_id}-${i}`}
              index={i}
              reducedMotion={reducedMotion}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              <div className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{m.nombre}</p>
                  <p className="text-xs text-muted-foreground">{m.rancho} · {m.frecuencia}</p>
                </div>
                <div className="text-right flex-shrink-0 space-y-1">
                  <ChipPct pct={m.pct} />
                  <p className="text-xs text-muted-foreground tabular-nums">
                    <AnimatedNumber value={m.cubiertos} format={n => String(Math.round(n))} reducedMotion={reducedMotion} />/{m.esperados}
                  </p>
                </div>
              </div>
              {huecos.length > 0 && (
                <div className="px-3 pb-3 border-t border-border pt-2" style={{ backgroundColor: 'var(--muted)' }}>
                  <p className="text-xs" style={{ color: 'var(--agro-warning-text)' }}>
                    Sin registro: {huecos.map(formatFechaCorta).join(', ')}
                  </p>
                </div>
              )}
            </EntradaEscalonada>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground pt-2">
        Solo módulos con frecuencia fija; los de por evento no se miden aquí.
      </p>
    </div>
  )
}

// ── Pestaña Campo ─────────────────────────────────────────────────────────────

function TabCampo({ datos }: { datos: MetCampo }) {
  const reducedMotion = useReducedMotion()
  const porMes = datos.aplicaciones_por_mes ?? {}
  const meses = Object.keys(porMes).sort()
  const productosTop = datos.productos_top ?? []
  const cosechasEnIntervalo = datos.cosechas_en_intervalo ?? []

  if (meses.length === 0 && productosTop.length === 0) return <Vacio />

  return (
    <div className="space-y-6 px-4 pt-4 pb-8">
      {/* Aplicaciones por mes */}
      {meses.length > 0 && (
        <section>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>
            APLICACIONES POR MES
          </p>
          {meses.length <= 1 ? (
            <div className="grid grid-cols-2 gap-3">
              <EntradaEscalonada index={0} reducedMotion={reducedMotion}>
                <TarjetaResumen
                  label="Aplicaciones"
                  valor={<AnimatedNumber value={porMes[meses[0]]?.aplicaciones ?? 0} format={n => Math.round(n).toLocaleString('es-MX')} reducedMotion={reducedMotion} />}
                />
              </EntradaEscalonada>
              <EntradaEscalonada index={1} reducedMotion={reducedMotion}>
                <TarjetaResumen
                  label="Hectáreas"
                  valor={<AnimatedNumber value={porMes[meses[0]]?.ha ?? 0} format={n => n.toFixed(1)} reducedMotion={reducedMotion} />}
                />
              </EntradaEscalonada>
            </div>
          ) : (
            <GraficaBarrasMes
              series={[
                { label: 'Aplicaciones', color: 'var(--primary)', valores: meses.map(m => porMes[m]?.aplicaciones ?? 0) },
              ]}
              meses={meses}
              ariaLabel={meses.map(m => {
                const mo = parseInt(m.split('-')[1]) - 1
                const ns = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']
                return `${ns[mo]}: ${porMes[m]?.aplicaciones ?? 0} aplicaciones`
              }).join('; ')}
            />
          )}
        </section>
      )}

      {/* Top productos */}
      {productosTop.length > 0 && (
        <section>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--muted-foreground)' }}>
            TOP PRODUCTOS
          </p>
          <div className="space-y-2">
            {productosTop.map((p, i) => {
              const maxP = productosTop[0]?.aplicaciones ?? 1
              const pct = (p.aplicaciones / maxP) * 100
              return (
                <EntradaEscalonada key={i} index={i} reducedMotion={reducedMotion} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate" style={{ color: 'var(--foreground)' }}>{p.producto}</span>
                    <span className="tabular-nums flex-shrink-0 ml-2 text-xs" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      <AnimatedNumber value={p.aplicaciones} format={n => Math.round(n).toLocaleString('es-MX')} reducedMotion={reducedMotion} />
                    </span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--muted)' }}>
                    <motion.div
                      className="h-full rounded-full origin-left"
                      style={{ backgroundColor: 'var(--primary)', opacity: 0.7 }}
                      initial={reducedMotion ? false : { scaleX: 0 }}
                      animate={{ scaleX: pct / 100 }}
                      transition={reducedMotion ? { duration: 0 } : { ...SPRING_SUAVE_SIN_REBOTE, delay: Math.min(i * 0.04, 0.4) + 0.1 }}
                    />
                  </div>
                </EntradaEscalonada>
              )
            })}
          </div>
        </section>
      )}

      {/* Cosechas en intervalo de seguridad */}
      {cosechasEnIntervalo.length > 0 && (
        <section>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--agro-danger-text)' }}>
            COSECHAS DENTRO DEL INTERVALO DE SEGURIDAD
          </p>
          <div className="space-y-2">
            {cosechasEnIntervalo.map((c, i) => (
              <EntradaEscalonada
                key={i}
                index={i}
                reducedMotion={reducedMotion}
                className="rounded-xl border p-3 space-y-1"
                style={{ borderColor: 'var(--agro-danger-fill)', backgroundColor: 'var(--agro-danger-fill)' }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold" style={{ color: 'var(--agro-danger-text)' }}>
                    {c.rancho}
                  </p>
                  <span className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>{c.sector}</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
                  Cosecha: {c.fecha} · Aplic.: {c.aplicacion_fecha}
                </p>
                <p className="text-xs" style={{ color: 'var(--agro-danger-text)' }}>
                  Permitida desde: {c.cosecha_permitida_desde}
                </p>
              </EntradaEscalonada>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// ── Filtros ───────────────────────────────────────────────────────────────────

interface FiltrosProps {
  periodo: PeriodoKey
  setPeriodo: (p: PeriodoKey) => void
  desdePersonalizado: string
  hastaPersonalizado: string
  setDesdePersonalizado: (v: string) => void
  setHastaPersonalizado: (v: string) => void
  ranchoId: string
  setRanchoId: (v: string) => void
  ranchos: { id: string; nombre: string }[]
  terminoSingular: string
  esAdmin: boolean
  pestanaActiva: string
}

function Filtros({
  periodo, setPeriodo,
  desdePersonalizado, hastaPersonalizado,
  setDesdePersonalizado, setHastaPersonalizado,
  ranchoId, setRanchoId,
  ranchos, terminoSingular, esAdmin, pestanaActiva,
}: FiltrosProps) {
  const mostrarRancho = esAdmin && pestanaActiva !== 'agenda'
  const reducedMotion = useReducedMotion()
  return (
    <div
      className="sticky top-0 z-10 px-4 py-3 border-b border-border"
      style={{ backgroundColor: 'var(--card)' }}
    >
      {/* Selector de periodo — fondo deslizante (layoutId + SPRING_SUAVE) */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {PERIODOS.map(p => {
          const activo = periodo === p.key
          return (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              className="relative flex-shrink-0 text-xs px-3 py-1.5 rounded-full"
              style={{
                color: activo ? '#fff' : 'var(--muted-foreground)',
                fontWeight: activo ? 600 : 400,
              }}
            >
              {activo && (
                <motion.span
                  layoutId="metricas-periodo-pill"
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: 'var(--primary)', zIndex: -1 }}
                  transition={reducedMotion ? { duration: 0 } : SPRING_SUAVE}
                />
              )}
              {!activo && (
                <span className="absolute inset-0 rounded-full" style={{ backgroundColor: 'var(--muted)', zIndex: -1 }} />
              )}
              <span className="relative">{p.label}</span>
            </button>
          )
        })}
      </div>

      {/* Fechas personalizadas — desplegable, cerrado = 0 real */}
      <div className={`accordion-rows ${periodo === 'personalizado' ? 'is-open' : ''}`}>
        <div>
          <div className="flex gap-2 pt-3">
            <input
              type="date"
              value={desdePersonalizado}
              onChange={e => setDesdePersonalizado(e.target.value)}
              className="flex-1 h-9 px-3 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: 'var(--input-background)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}
            />
            <input
              type="date"
              value={hastaPersonalizado}
              onChange={e => setHastaPersonalizado(e.target.value)}
              className="flex-1 h-9 px-3 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: 'var(--input-background)',
                border: '1px solid var(--border)',
                color: 'var(--foreground)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Selector de rancho */}
      {mostrarRancho && (
        <select
          value={ranchoId}
          onChange={e => setRanchoId(e.target.value)}
          className="w-full h-9 px-3 rounded-lg text-sm outline-none mt-3"
          style={{
            backgroundColor: 'var(--input-background)',
            border: '1px solid var(--border)',
            color: 'var(--foreground)',
          }}
        >
          <option value="">Todos los {terminoSingular.toLowerCase()}s</option>
          {ranchos.map(r => (
            <option key={r.id} value={r.id}>{r.nombre}</option>
          ))}
        </select>
      )}
    </div>
  )
}

// ── Pantalla principal ────────────────────────────────────────────────────────

type PestanaKey = 'productividad' | 'agenda' | 'cumplimiento' | 'constancia' | 'campo'

interface PestanaConfig { key: PestanaKey; label: string; icon: React.ReactNode }

export function Metricas() {
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const { profile } = useAuthContext()
  const { modulos, terminosSitio } = useModulosContext()
  const { ranchos } = useRanchos()
  const { cargarProductividad, cargarAgenda, cargarCumplimiento, cargarConstancia, cargarCampo } = useMetricas()

  const esAdmin = profile?.rol === 'admin_org' || profile?.rol === 'super_admin'
  const tieneCampo = modulos.some(m => m.sector_clave === 'campo')

  // Redirigir auditor
  useEffect(() => {
    if (profile?.rol === 'auditor') navigate('/auditor', { replace: true })
  }, [profile?.rol, navigate])

  // Estado de filtros
  const hoy = hoyMX()
  const [periodo, setPeriodo] = useState<PeriodoKey>('este_mes')
  const [desdePersonalizado, setDesdePersonalizado] = useState(hoy)
  const [hastaPersonalizado, setHastaPersonalizado] = useState(hoy)
  const [ranchoId, setRanchoId] = useState('')

  // Pestañas disponibles
  const pestanas: PestanaConfig[] = [
    { key: 'productividad', label: 'Productividad', icon: <TrendingUp className="w-4 h-4" /> },
    { key: 'agenda', label: 'Agenda', icon: <Clock className="w-4 h-4" /> },
    ...(esAdmin ? [
      { key: 'cumplimiento' as PestanaKey, label: 'Cumplimiento', icon: <CheckCircle2 className="w-4 h-4" /> },
      { key: 'constancia' as PestanaKey, label: 'Constancia', icon: <BarChart3 className="w-4 h-4" /> },
      ...(tieneCampo ? [{ key: 'campo' as PestanaKey, label: 'Campo', icon: <AlertTriangle className="w-4 h-4" /> }] : []),
    ] : []),
  ]

  const [pestanaActiva, setPestanaActiva] = useState<PestanaKey>('productividad')
  // Dirección del deslizamiento al cambiar de pestaña, según el índice de
  // la pestaña elegida respecto a la actual (como el stepper de M1).
  const [direccionPestana, setDireccionPestana] = useState<1 | -1>(1)
  function cambiarPestana(key: PestanaKey) {
    const iActual = pestanas.findIndex(p => p.key === pestanaActiva)
    const iNueva = pestanas.findIndex(p => p.key === key)
    setDireccionPestana(iNueva >= iActual ? 1 : -1)
    setPestanaActiva(key)
  }

  // Datos por pestaña
  const [datosProd, setDatosProd] = useState<MetProductividad | null>(null)
  const [datosAgenda, setDatosAgenda] = useState<MetAgenda | null>(null)
  const [datosCumpl, setDatosCumpl] = useState<MetCumplimiento | null>(null)
  const [datosConst, setDatosConst] = useState<MetConstancia | null>(null)
  const [datosCampo, setDatosCampo] = useState<MetCampo | null>(null)
  const [cargando, setCargando] = useState(false)

  const resolverFechas = useCallback((): { desde: string; hasta: string } => {
    if (periodo === 'personalizado') {
      return { desde: desdePersonalizado || hoy, hasta: hastaPersonalizado || hoy }
    }
    return calcularPeriodo(periodo)
  }, [periodo, desdePersonalizado, hastaPersonalizado, hoy])

  const cargarPestana = useCallback(async (pestana: PestanaKey) => {
    const { desde, hasta } = resolverFechas()
    const rancho = ranchoId || null
    setCargando(true)
    try {
      if (pestana === 'productividad') {
        const d = await cargarProductividad(desde, hasta, rancho)
        setDatosProd(d)
      } else if (pestana === 'agenda') {
        const d = await cargarAgenda(desde, hasta)
        setDatosAgenda(d)
      } else if (pestana === 'cumplimiento') {
        const d = await cargarCumplimiento(desde, hasta, rancho)
        setDatosCumpl(d)
      } else if (pestana === 'constancia') {
        const d = await cargarConstancia(desde, hasta, rancho)
        setDatosConst(d)
      } else if (pestana === 'campo') {
        const d = await cargarCampo(desde, hasta, rancho)
        setDatosCampo(d)
      }
    } finally {
      setCargando(false)
    }
  }, [resolverFechas, ranchoId, cargarProductividad, cargarAgenda, cargarCumplimiento, cargarConstancia, cargarCampo])

  // Cargar al montar y al cambiar filtros o pestaña
  useEffect(() => {
    if (profile?.rol === 'auditor') return
    cargarPestana(pestanaActiva)
  }, [pestanaActiva, periodo, desdePersonalizado, hastaPersonalizado, ranchoId]) // eslint-disable-line react-hooks/exhaustive-deps

  const modulosParaDesglose = modulos.map(m => ({ codigo: m.codigo, nombre: m.nombre }))

  // ¿La pestaña activa ya tiene datos de una carga previa? Si es así, un
  // cambio de periodo/sitio no debe desmontar el contenido (para que los
  // contadores y las barras puedan animar del valor anterior al nuevo).
  const tieneDatosPestanaActiva = (
    (pestanaActiva === 'productividad' && datosProd != null) ||
    (pestanaActiva === 'agenda' && datosAgenda != null) ||
    (pestanaActiva === 'cumplimiento' && datosCumpl != null) ||
    (pestanaActiva === 'constancia' && datosConst != null) ||
    (pestanaActiva === 'campo' && datosCampo != null)
  )

  function renderTab() {
    if (pestanaActiva === 'productividad') {
      if (!datosProd) return <Vacio />
      return <TabProductividad datos={datosProd} modulos={modulosParaDesglose} esAdmin={esAdmin} />
    }
    if (pestanaActiva === 'agenda') {
      if (!datosAgenda) return <Vacio />
      return <TabAgenda datos={datosAgenda} />
    }
    if (pestanaActiva === 'cumplimiento') {
      if (!datosCumpl) return <Vacio />
      if (datosCumpl.permitido === false) return <Vacio mensaje="No tienes permiso para ver esta sección" />
      return <TabCumplimiento datos={datosCumpl} />
    }
    if (pestanaActiva === 'constancia') {
      if (!datosConst) return <Vacio />
      if (datosConst.permitido === false) return <Vacio mensaje="No tienes permiso para ver esta sección" />
      return <TabConstancia datos={datosConst} />
    }
    if (pestanaActiva === 'campo') {
      if (!datosCampo) return <Vacio />
      if (datosCampo.permitido === false) return <Vacio mensaje="No tienes permiso para ver esta sección" />
      return <TabCampo datos={datosCampo} />
    }
    return null
  }

  function renderContenido() {
    // Primera carga de la pestaña (sin datos todavía): skeleton completo.
    if (cargando && !tieneDatosPestanaActiva) return <TabSkeleton />

    // Carga por cambio de periodo/sitio con datos ya en pantalla: se deja
    // el contenido visible (atenuado) con una barra de carga arriba, en
    // vez de desmontarlo — así los contadores y filas pueden animar.
    const atenuado = cargando && tieneDatosPestanaActiva
    return (
      <>
        {atenuado && !reducedMotion && (
          <div className="h-0.5 overflow-hidden" style={{ backgroundColor: 'var(--muted)' }}>
            <motion.div
              className="h-full w-1/3 rounded-full"
              style={{ backgroundColor: 'var(--primary)' }}
              animate={{ x: ['-100%', '300%'] }}
              transition={{ duration: 1.1, ease: 'linear', repeat: Infinity }}
            />
          </div>
        )}
        <div
          style={{
            opacity: atenuado ? 0.6 : 1,
            transition: reducedMotion ? undefined : 'opacity var(--motion-base) var(--ease-out)',
          }}
        >
          {renderTab()}
        </div>
      </>
    )
  }

  if (profile?.rol === 'auditor') return null

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      {/* Header móvil */}
      <div className="flex items-center gap-3 px-4 py-4 md:hidden border-b border-border" style={{ backgroundColor: 'var(--card)' }}>
        <BarChart3 className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--primary)' }} />
        <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
          {esAdmin ? 'Métricas' : 'Mis métricas'}
        </h1>
      </div>

      {/* Filtros */}
      <Filtros
        periodo={periodo}
        setPeriodo={p => { setPeriodo(p) }}
        desdePersonalizado={desdePersonalizado}
        hastaPersonalizado={hastaPersonalizado}
        setDesdePersonalizado={setDesdePersonalizado}
        setHastaPersonalizado={setHastaPersonalizado}
        ranchoId={ranchoId}
        setRanchoId={setRanchoId}
        ranchos={ranchos}
        terminoSingular={terminosSitio.singular}
        esAdmin={esAdmin}
        pestanaActiva={pestanaActiva}
      />

      {/* Pestañas — fondo deslizante (layoutId + SPRING_SUAVE) */}
      <div
        className="flex gap-1 overflow-x-auto no-scrollbar px-4 py-2 border-b border-border flex-shrink-0"
        style={{ backgroundColor: 'var(--card)' }}
      >
        {pestanas.map(p => {
          const activa = pestanaActiva === p.key
          return (
            <button
              key={p.key}
              onClick={() => cambiarPestana(p.key)}
              className="relative flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
              style={{
                color: activa ? '#fff' : 'var(--muted-foreground)',
                fontWeight: activa ? 600 : 400,
              }}
            >
              {activa && (
                <motion.span
                  layoutId="metricas-pestana-pill"
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: 'var(--primary)', zIndex: -1 }}
                  transition={reducedMotion ? { duration: 0 } : SPRING_SUAVE}
                />
              )}
              {!activa && (
                <span className="absolute inset-0 rounded-full" style={{ backgroundColor: 'var(--muted)', zIndex: -1 }} />
              )}
              <span className="relative flex items-center gap-1.5">
                {p.icon}
                {p.label}
              </span>
            </button>
          )
        })}
      </div>

      {/* Contenido — entra desde el lado de la pestaña elegida */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pestanaActiva}
            initial={reducedMotion ? false : { opacity: 0, x: direccionPestana * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reducedMotion ? undefined : { opacity: 0, x: -direccionPestana * 24 }}
            transition={reducedMotion ? { duration: 0 } : TAB_TRANSITION}
          >
            {renderContenido()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
