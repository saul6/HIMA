import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { AvisoCargaLenta } from '@/app/components/ui-mady/AvisoCargaLenta'
import { motion, AnimatePresence, useReducedMotion } from 'motion/react'
import { BarChart3, ChevronDown, AlertTriangle, CheckCircle2, AlertCircle, XCircle, CircleDashed, Clock, TrendingUp } from 'lucide-react'
import { useAuthContext } from '@/context/AuthContext'
import { useModulosContext } from '@/context/ModulosContext'
import { useRanchos } from '@/hooks/useRanchos'
import { useMetricas } from '@/hooks/useMetricas'
import { useContadorAnimado } from '@/hooks/useContadorAnimado'
import { hoyMX } from '@/lib/fecha'
import { SPRING_SUAVE, SPRING_SUAVE_SIN_REBOTE, DUR, EASE_OUT, entrada, useEntradaPantalla } from '@/lib/motion'
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
import { EncabezadoPantalla } from '@/app/components/EncabezadoPantalla'
import { TarjetaContador } from '@/app/components/ui-mady/TarjetaContador'
import { Panel } from '@/app/components/ui-mady/Panel'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { SelectorSegmentado } from '@/app/components/ui-mady/SelectorSegmentado'
import { FiltroPildoras } from '@/app/components/FiltroPildoras'
import { Skeleton } from '@/app/components/ui/skeleton'
import { formatoNumero, formatoPct } from '@/lib/formato'

// Mismo timing/curva que el resto de la app (tokens de @/lib/motion).
const TAB_TRANSITION = { duration: DUR.base, ease: EASE_OUT }

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
  else if (pct < 90) { color = 'var(--agro-info-text)'; bg = 'var(--agro-info-fill)' }
  return (
    <span className="text-xs px-1.5 py-0.5 rounded-md tabular-nums" style={{ color, backgroundColor: bg }}>
      {formatoPct(Math.round(pct))}
    </span>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-4 pb-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="space-y-2 rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
      <AvisoCargaLenta />
    </div>
  )
}

// ── Vacío ─────────────────────────────────────────────────────────────────────

function Vacio({ mensaje = 'Sin datos en este periodo' }: { mensaje?: string }) {
  return <EstadoVacio icono={BarChart3} titulo={mensaje} />
}

// ── Contador animado (mismo patrón que Home.tsx `AnimatedNumber`) ────────────

function AnimatedNumber({
  value, format, reducedMotion,
}: { value: number | null; format: (n: number) => string; reducedMotion: boolean }) {
  const spanRef = useContadorAnimado(value, format, reducedMotion)
  return <span ref={spanRef}>{value === null ? '—' : format(value)}</span>
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
      <div className="grid grid-cols-2 gap-3 px-4 pt-4 lg:grid-cols-4">
        {esAdmin ? (
          <>
            <TarjetaContador
              indice={0}
              etiqueta="Total capturas"
              valor={totalCapturas}
              format={n => formatoNumero(Math.round(n))}
            />
            <TarjetaContador
              indice={1}
              etiqueta="Colaboradores con capturas"
              valor={<>
                <AnimatedNumber value={colConCapturas} format={n => String(Math.round(n))} reducedMotion={reducedMotion} /> de{' '}
                <AnimatedNumber value={totalCol} format={n => String(Math.round(n))} reducedMotion={reducedMotion} />
              </>}
            />
            <TarjetaContador
              indice={2}
              etiqueta="Con corrección"
              valor={pctCorreccion}
              format={n => formatoPct(n)}
              sub={`${totalCorrecciones} registros`}
            />
          </>
        ) : (
          <>
            <TarjetaContador
              indice={0}
              etiqueta="Mis capturas"
              valor={mr?.capturas ?? 0}
              format={n => formatoNumero(Math.round(n))}
            />
            <TarjetaContador
              indice={1}
              etiqueta="Mi posición"
              valor={miPosicion != null ? (
                <>
                  #<AnimatedNumber value={miPosicion} format={n => String(Math.round(n))} reducedMotion={reducedMotion} /> de{' '}
                  <AnimatedNumber value={totalCol} format={n => String(Math.round(n))} reducedMotion={reducedMotion} />
                </>
              ) : '—'}
            />
            <TarjetaContador
              indice={2}
              etiqueta="Con corrección"
              valor={mr?.pct_correccion != null ? mr.pct_correccion : null}
              format={n => formatoPct(n)}
            />
          </>
        )}
        {v && (
          <TarjetaContador
            indice={3}
            etiqueta="Verificados"
            valor={v.verificados}
            format={n => formatoNumero(Math.round(n))}
            sub={`${v.pendientes_verificar} pendientes${v.horas_promedio != null ? ` · ${v.horas_promedio.toFixed(1)} h prom.` : ''}`}
          />
        )}
      </div>

      {/* Ranking */}
      <div className="px-4">
        <Panel titulo="Ranking de colaboradores">
        <div className="divide-y divide-border">
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
              if (c.posicion === 1) { posBg = 'var(--primary)'; posColor = 'var(--primary-foreground)' }
              else if (c.posicion === 2) { posBg = 'var(--agro-info-fill)'; posColor = 'var(--agro-info-text)' }
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
                          style={{ backgroundColor: 'var(--mint-tint-fill)', color: 'var(--mint-tint-text)', outline: '1px solid var(--mint-tint-border)' }}
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
                        <AnimatedNumber value={c.capturas} format={n => formatoNumero(Math.round(n))} reducedMotion={reducedMotion} />
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
                              ? `${formatoPct((c.pct_correccion ?? 0))} corrección`
                              : 'Sin correcciones'}
                          </span>
                          {(c.sin_firma ?? 0) > 0 && (
                            <span style={{ color: 'var(--agro-info-text)' }}>
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
                transition={animarEntrada ? { duration: DUR.base, ease: EASE_OUT, delay: delayFila } : { duration: 0 }}
                className="overflow-hidden"
                style={{ backgroundColor: c.es_yo ? 'var(--agro-success-fill)' : undefined }}
              >
                {tieneDesglose ? (
                  <button
                    className="w-full text-left px-2 py-3 transition-colors hover:bg-muted"
                    style={{ transitionDuration: 'var(--motion-fast)' }}
                    onClick={() => setExpandido(abierto ? null : c.profile_id)}
                    aria-expanded={abierto}
                  >
                    {rowInner}
                  </button>
                ) : (
                  <div className="px-2 py-3">{rowInner}</div>
                )}

                {/* Desglose por módulo — mismo patrón de desplegable (accordion-rows) */}
                {tieneDesglose && (
                  <div className={`accordion-rows ${abierto ? 'is-open' : ''}`}>
                    <div>
                      <div
                        className="px-2 pb-3 pt-0 border-t border-border"
                        style={{ backgroundColor: 'var(--muted)' }}
                      >
                        <TituloSeccion variante="subtitulo" as="p" className="mt-2 mb-2">Desglose por módulo</TituloSeccion>
                        <div className="space-y-1">
                          {porModuloEntries.map(([codigo, n]) => {
                            const mod = modulos.find(m => m.codigo === codigo)
                            return (
                              <div key={codigo} className="flex items-center justify-between text-sm">
                                <span style={{ color: 'var(--foreground)' }}>
                                  {mod ? mod.nombre : codigo}
                                </span>
                                <span className="tabular-nums font-semibold" style={{ color: 'var(--primary)' }}>
                                  {formatoNumero((n as number))}
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
        </Panel>
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
    <div className="grid gap-4 px-4 pt-4 pb-8 lg:grid-cols-2">
      {colaboradores.map((c, i) => {
        const pctATiempo = c.cerradas > 0 ? (c.a_tiempo / c.cerradas) * 100 : null
        return (
          <motion.div key={c.profile_id} {...entrada(i, reducedMotion)} className="min-w-0">
            <Panel titulo={c.nombre}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <TarjetaContador etiqueta="Asignadas" valor={c.asignadas} />
                <TarjetaContador etiqueta="Cerradas" valor={c.cerradas} />
                <TarjetaContador
                  etiqueta="% a tiempo"
                  valor={pctATiempo != null ? <ChipPct pct={pctATiempo} /> : '—'}
                />
                <TarjetaContador
                  etiqueta="Vencidas"
                  valor={c.vencidas_abiertas}
                  tono={c.vencidas_abiertas > 0 ? 'alertaTexto' : 'normal'}
                />
                <TarjetaContador etiqueta="Regresadas" valor={c.regresadas} />
                <TarjetaContador
                  etiqueta="Días prom."
                  valor={c.dias_promedio_cierre}
                  format={n => n.toFixed(1)}
                />
              </div>
            </Panel>
          </motion.div>
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
                        className="absolute text-caption tabular-nums text-center w-full"
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
              <span className="text-caption text-muted-foreground text-center mt-1">
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
    case 'parcial':      return { color: 'var(--agro-info-text)', bg: 'var(--agro-info-fill)' }
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
    <Panel className="overflow-hidden p-0">
      <button
        type="button"
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        style={{ backgroundColor: 'var(--card)' }}
        onClick={() => setAbierto(a => !a)}
        aria-expanded={abierto}
      >
        <cfg.Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
        <TituloSeccion as="p" className="mb-0 flex-1">{cfg.label}</TituloSeccion>
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
                <motion.div {...entrada(i, reducedMotion)}
                  key={i}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{ backgroundColor: 'var(--card)' }}>
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
                          {formatoPct(a.porcentaje)}
                        </span>
                        <p className="text-xs tabular-nums mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                          {a.puntos}/{a.posibles} pts
                        </p>
                      </>
                    ) : (
                      <span className="text-xs tabular-nums" style={{ color: 'var(--muted-foreground)' }}>0/0 pts</span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </Panel>
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
    <div className="space-y-4 px-4 pt-4 pb-8">
      {/* Auditorías internas */}
      {internas.length > 0 && (
        <Panel titulo="Auditorías internas">
          {/* Tarjetas de promedio por módulo */}
          {datos.internas_resumen && datos.internas_resumen.length > 0 && (() => {
            const resumen = datos.internas_resumen!
            return (
              <>
                <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                  {resumen.map((r, i) => {
                    const banda = r.promedio != null
                      ? bandaCumplimiento(r.promedio, r.con_puntaje > 0 ? 1 : 0)
                      : 'sin_puntaje'
                    const { color, bg } = estilosBanda(banda)
                    return (
                      <TarjetaContador
                        key={r.modulo}
                        indice={i}
                        etiqueta={r.nombre}
                        valor={r.promedio != null ? (
                          <span className="rounded-lg px-2 py-0.5" style={{ color, backgroundColor: bg }}>
                            <AnimatedNumber value={r.promedio} format={n => `${formatoPct(n)}`} reducedMotion={reducedMotion} />
                          </span>
                        ) : '—'}
                        sub={`${r.auditorias} auditoría${r.auditorias !== 1 ? 's' : ''}${r.sin_puntaje > 0 ? ` · ${r.sin_puntaje} sin puntaje` : ''}`}
                      />
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
        </Panel>
      )}

      {/* Auditorías externas */}
      {externas.length > 0 && (
        <Panel titulo="Auditorías externas">
          <div className="divide-y divide-border">
            {externas.map((a, i) => (
              <motion.div key={i} {...entrada(i, reducedMotion)} className="space-y-1 py-2.5 first:pt-0 last:pb-0">
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
                  <p className="text-xs" style={{ color: 'var(--agro-info-text)' }}>
                    {a.nc_abiertas} NC{a.nc_abiertas > 1 ? 's' : ''} abiertas
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        </Panel>
      )}

      {/* Incidencias M13 por mes */}
      {datos.incidencias && porMes.length > 0 && (
        <Panel titulo="Incidencias M13 por mes">
          {porMes.length <= 1 ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <TarjetaContador
                  indice={0}
                  etiqueta="Reportes"
                  valor={datos.incidencias.reportes}
                  format={n => formatoNumero(Math.round(n))}
                />
                <TarjetaContador
                  indice={1}
                  etiqueta="Incidencias"
                  valor={datos.incidencias.incidencias}
                  format={n => formatoNumero(Math.round(n))}
                />
              </div>
              <p className="text-xs text-muted-foreground">Un reporte puede tener varias incidencias</p>
            </div>
          ) : (
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
          )}
        </Panel>
      )}

      {/* Fallas recurrentes */}
      {fallas.length > 0 && (
        <Panel titulo={`Puntos de falla recurrentes (top ${fallas.length})`}>
          <div className="divide-y divide-border">
            {fallas.map((f, i) => (
              <motion.div key={i} {...entrada(i, reducedMotion)} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <span className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>
                    {f.modulo}
                  </span>
                  <p className="text-sm" style={{ color: 'var(--foreground)' }}>{f.punto}</p>
                </div>
                <span className="text-sm tabular-nums flex-shrink-0 font-semibold" style={{ color: 'var(--agro-danger-text)' }}>
                  ×<AnimatedNumber value={f.veces} format={n => String(Math.round(n))} reducedMotion={reducedMotion} />
                </span>
              </motion.div>
            ))}
          </div>
        </Panel>
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
      <div className="grid gap-4 lg:grid-cols-2">
        {modulos.map((m, i) => {
          const huecos = m.huecos_recientes ?? []
          return (
            <motion.div
              key={`${m.modulo}-${m.rancho_id}-${i}`}
              {...entrada(i, reducedMotion)}
              className="min-w-0"
            >
              <Panel titulo={m.nombre} acciones={<ChipPct pct={m.pct} />}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">{m.rancho} · {m.frecuencia}</p>
                  <p className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                    <AnimatedNumber value={m.cubiertos} format={n => String(Math.round(n))} reducedMotion={reducedMotion} />/{m.esperados}
                  </p>
                </div>
                {huecos.length > 0 && (
                  <p className="mt-2.5 rounded-lg px-3 py-2 text-xs" style={{ backgroundColor: 'var(--muted)', color: 'var(--agro-info-text)' }}>
                    Sin registro: {huecos.map(formatFechaCorta).join(', ')}
                  </p>
                )}
              </Panel>
            </motion.div>
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
    <div className="space-y-4 px-4 pt-4 pb-8">
      {/* Aplicaciones por mes */}
      {meses.length > 0 && (
        <Panel titulo="Aplicaciones por mes">
          {meses.length <= 1 ? (
            <div className="grid grid-cols-2 gap-3">
              <TarjetaContador
                indice={0}
                etiqueta="Aplicaciones"
                valor={porMes[meses[0]]?.aplicaciones ?? 0}
                format={n => formatoNumero(Math.round(n))}
              />
              <TarjetaContador
                indice={1}
                etiqueta="Hectáreas"
                valor={porMes[meses[0]]?.ha ?? 0}
                format={n => n.toFixed(1)}
              />
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
        </Panel>
      )}

      {/* Top productos */}
      {productosTop.length > 0 && (
        <Panel titulo="Top productos">
          <div className="space-y-2">
            {productosTop.map((p, i) => {
              const maxP = productosTop[0]?.aplicaciones ?? 1
              const pct = (p.aplicaciones / maxP) * 100
              return (
                <motion.div key={i} {...entrada(i, reducedMotion)} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate" style={{ color: 'var(--foreground)' }}>{p.producto}</span>
                    <span className="tabular-nums flex-shrink-0 ml-2 text-xs font-semibold" style={{ color: 'var(--primary)' }}>
                      <AnimatedNumber value={p.aplicaciones} format={n => formatoNumero(Math.round(n))} reducedMotion={reducedMotion} />
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
                </motion.div>
              )
            })}
          </div>
        </Panel>
      )}

      {/* Cosechas en intervalo de seguridad */}
      {cosechasEnIntervalo.length > 0 && (
        <Panel titulo="Cosechas dentro del intervalo de seguridad">
          <div className="grid gap-3 lg:grid-cols-2">
            {cosechasEnIntervalo.map((c, i) => (
              <motion.div
                key={i}
                {...entrada(i, reducedMotion)}
                className="rounded-lg border p-3 space-y-1"
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
              </motion.div>
            ))}
          </div>
        </Panel>
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

const CLASE_CONTROL =
  'w-full rounded-lg border border-border-control bg-input-background px-3 text-sm text-foreground focus:border-primary focus:outline-none'

function Filtros({
  periodo, setPeriodo,
  desdePersonalizado, hastaPersonalizado,
  setDesdePersonalizado, setHastaPersonalizado,
  ranchoId, setRanchoId,
  ranchos, terminoSingular, esAdmin, pestanaActiva,
}: FiltrosProps) {
  const mostrarRancho = esAdmin && pestanaActiva !== 'agenda'
  return (
    <div>
      {/* Selector de periodo */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
        <FiltroPildoras<PeriodoKey>
          options={PERIODOS.map(p => ({ value: p.key, label: p.label }))}
          value={periodo}
          onChange={setPeriodo}
        />
      </div>

      {/* Fechas personalizadas — desplegable, cerrado = 0 real */}
      <div className={`accordion-rows ${periodo === 'personalizado' ? 'is-open' : ''}`}>
        <div>
          <div className="flex gap-2 pt-3">
            <input
              type="date"
              value={desdePersonalizado}
              onChange={e => setDesdePersonalizado(e.target.value)}
              aria-label="Desde"
              className={`${CLASE_CONTROL} h-10 flex-1`}
            />
            <input
              type="date"
              value={hastaPersonalizado}
              onChange={e => setHastaPersonalizado(e.target.value)}
              aria-label="Hasta"
              className={`${CLASE_CONTROL} h-10 flex-1`}
            />
          </div>
        </div>
      </div>

      {/* Selector de rancho */}
      {mostrarRancho && (
        <select
          value={ranchoId}
          onChange={e => setRanchoId(e.target.value)}
          aria-label={terminoSingular}
          className={`${CLASE_CONTROL} mt-3 h-10`}
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
  const ent = useEntradaPantalla(!cargando)

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
      <EncabezadoPantalla titulo="Métricas" fijo={false} />

      <div className="space-y-3 px-4 pt-4 flex-shrink-0">
        {/* Filtros */}
        <motion.div {...ent(0)}>
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
        </motion.div>

        {/* Pestañas */}
        <motion.div {...ent(1)}>
          <SelectorSegmentado<PestanaKey>
            ariaLabel="Secciones de métricas"
            value={pestanaActiva}
            onChange={cambiarPestana}
            options={pestanas.map(p => ({
              value: p.key,
              label: <span className="flex items-center gap-1.5">{p.icon}{p.label}</span>,
            }))}
          />
        </motion.div>
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
