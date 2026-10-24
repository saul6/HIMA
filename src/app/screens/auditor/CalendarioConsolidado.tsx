import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, ChevronRight, CalendarDays, Loader, RefreshCw } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/app/components/ui/skeleton'
import { useCalendario, type EventoCalendario } from '@/hooks/useCalendario'
import { DUR, EASE_OUT } from '@/lib/motion'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

const TIPO_CONFIG: Record<string, { fillVar: string; textVar: string }> = {
  AUDIT:             { fillVar: 'var(--agro-success-fill)', textVar: 'var(--agro-success-text)' },
  CORRECTIVE_ACTION: { fillVar: 'var(--agro-danger-fill)',  textVar: 'var(--agro-danger-text)' },
  TRAINING:          { fillVar: 'var(--muted)',             textVar: 'var(--primary)' },
  FOLLOW_UP:         { fillVar: 'var(--agro-info-fill)', textVar: 'var(--agro-info-text)' },
  DOCUMENT_REVIEW:   { fillVar: 'var(--muted)',             textVar: 'var(--muted-foreground)' },
  MEETING:           { fillVar: 'var(--muted)',             textVar: 'var(--primary)' },
  VERIFICATION:      { fillVar: 'var(--agro-success-fill)', textVar: 'var(--agro-success-text)' },
  DEADLINE:          { fillVar: 'var(--agro-danger-fill)',  textVar: 'var(--agro-danger-text)' },
}

interface CalendarioTipo { event_type: string; descripcion: string }

const pad = (n: number) => String(n).padStart(2, '0')

function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

function formatDayHeader(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split('-').map(Number)
  const date = new Date(y, m - 1, d, 12)
  const raw = date.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function formatHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-MX', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City',
  })
}

function EventoItem({
  evento,
  tipoLabel,
  onNavegar,
  index,
  reducedMotion,
}: {
  evento: EventoCalendario
  tipoLabel: string
  onNavegar: (() => void) | null
  index: number
  reducedMotion: boolean | null
}) {
  const tipo = TIPO_CONFIG[evento.event_type] ?? { fillVar: 'var(--muted)', textVar: 'var(--muted-foreground)' }
  const interactivo = !!onNavegar

  return (
    <motion.button
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{
        opacity: 1, y: 0,
        transition: { duration: DUR.base, ease: EASE_OUT, delay: Math.min(index, 7) * 0.03 },
      }}
      onClick={onNavegar ?? undefined}
      disabled={!interactivo}
      className={`w-full text-left rounded-xl border border-border px-4 py-3 flex flex-col gap-1.5 disabled:cursor-default transition-colors ${interactivo ? 'hover:bg-muted' : ''}`}
      style={{ backgroundColor: 'var(--card)', transitionDuration: 'var(--motion-fast)' }}
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className="text-caption font-semibold px-2 py-0.5 rounded-full leading-none"
          style={{ backgroundColor: tipo.fillVar, color: tipo.textVar }}
        >
          {tipoLabel}
        </span>
        {evento.estado && (
          <span
            className="text-caption px-2 py-0.5 rounded-full leading-none"
            style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
          >
            {evento.estado}
          </span>
        )}
      </div>
      <p className="text-sm font-medium leading-snug" style={{ color: 'var(--foreground)' }}>
        {evento.title}
      </p>
      {!evento.all_day && (
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {formatHora(evento.start_at)}
          {evento.end_at ? ` – ${formatHora(evento.end_at)}` : ''}
        </p>
      )}
      {interactivo && (
        <p className="text-caption font-semibold mt-0.5" style={{ color: 'var(--primary)' }}>
          Ver detalle →
        </p>
      )}
    </motion.button>
  )
}

export function CalendarioConsolidado() {
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()

  const [mesOffset, setMesOffset] = useState(0)
  const [calendarioTipos, setCalendarioTipos] = useState<CalendarioTipo[]>([])
  const [tiposActivos, setTiposActivos] = useState<Set<string>>(new Set())

  const { año, mes, desde, hasta, nombreMes } = useMemo(() => {
    const hoy = new Date()
    const base = new Date(hoy.getFullYear(), hoy.getMonth() + mesOffset, 1)
    const y = base.getFullYear()
    const m = base.getMonth()
    const lastDay = new Date(y, m + 1, 0).getDate()
    const rawNombre = base.toLocaleDateString('es-MX', { month: 'long' })
    return {
      año: y,
      mes: m,
      desde: `${y}-${pad(m + 1)}-01`,
      hasta: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
      nombreMes: rawNombre.charAt(0).toUpperCase() + rawNombre.slice(1),
    }
  }, [mesOffset])

  void mes

  useEffect(() => {
    ;(async () => {
      try {
        const { data } = await tbl('aud_calendario_tipos')
          .select('tipo, descripcion')
          .order('orden')
        setCalendarioTipos(
          ((data ?? []) as { tipo: string; descripcion: string }[]).map((t) => ({
            event_type: t.tipo,
            descripcion: t.descripcion,
          })),
        )
      } catch (e) {
        console.error('[CalendarioConsolidado] tipos', e)
      }
    })()
  }, [])

  const tiposArray = tiposActivos.size > 0 ? [...tiposActivos] : undefined
  const { eventos, cargando, recargar } = useCalendario(desde, hasta, tiposArray)

  function toggleTipo(t: string) {
    setTiposActivos(prev => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const tipoLabelMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of calendarioTipos) m.set(t.event_type, t.descripcion)
    return m
  }, [calendarioTipos])

  const eventosPorDia = useMemo(() => {
    const map = new Map<string, EventoCalendario[]>()
    for (const ev of eventos) {
      const key = dayKey(ev.start_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [eventos])

  return (
    <div className="flex flex-col gap-4">
      {/* Selector de mes + recargar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMesOffset(o => o - 1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
          aria-label="Mes anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="flex-1 text-center text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
          {nombreMes} {año}
        </p>
        <button
          onClick={() => setMesOffset(o => o + 1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
          aria-label="Mes siguiente"
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={recargar}
          disabled={cargando}
          className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Actualizar"
        >
          {cargando
            ? <Loader size={15} className="animate-spin motion-reduce:animate-none" style={{ color: 'var(--muted-foreground)' }} />
            : <RefreshCw size={15} style={{ color: 'var(--muted-foreground)' }} />
          }
        </button>
      </div>

      {/* Chips de filtro por tipo */}
      {calendarioTipos.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {calendarioTipos.map(t => {
            const activo = tiposActivos.has(t.event_type)
            const cfg = TIPO_CONFIG[t.event_type] ?? { fillVar: 'var(--muted)', textVar: 'var(--muted-foreground)' }
            return (
              <button
                key={t.event_type}
                onClick={() => toggleTipo(t.event_type)}
                className="text-caption font-semibold px-2.5 py-1 rounded-full transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                style={activo
                  ? { backgroundColor: cfg.textVar, color: 'var(--card)' }
                  : { backgroundColor: cfg.fillVar, color: cfg.textVar, border: '1px solid transparent' }
                }
              >
                {t.descripcion}
              </button>
            )
          })}
          {tiposActivos.size > 0 && (
            <button
              onClick={() => setTiposActivos(new Set())}
              className="text-caption px-2.5 py-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {/* Contenido */}
      {cargando ? (
        <div className="flex flex-col gap-2 pt-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-card rounded-xl border border-border px-4 py-3 space-y-2">
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          ))}
        </div>
      ) : eventosPorDia.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <CalendarDays size={32} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Sin eventos en {nombreMes.toLowerCase()}
          </p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {tiposActivos.size > 0 ? 'Prueba quitando los filtros activos.' : 'Aquí aparecerán visitas, vencimientos y capacitaciones.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {eventosPorDia.map(([dayIso, evs]) => (
            <section key={dayIso}>
              <p
                className="text-caption font-semibold uppercase tracking-wide mb-2"
                style={{ color: 'var(--muted-foreground)' }}
              >
                {formatDayHeader(dayIso)}
              </p>
              <div className="flex flex-col gap-2">
                {evs.map((ev, index) => (
                  <EventoItem
                    key={`${ev.source}-${ev.source_id}`}
                    index={index}
                    reducedMotion={reducedMotion}
                    evento={ev}
                    tipoLabel={tipoLabelMap.get(ev.event_type) ?? ev.event_type}
                    onNavegar={ev.route ? () => navigate(ev.route!) : null}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
