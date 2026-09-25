import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Calendar, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tbl = (name: string) => (supabase as any).from(name)

interface EventoAgenda {
  id: string
  tipo: 'visita' | 'aviso_borrado'
  titulo: string
  fecha_inicio: string
  fecha_fin: string
  estado: 'pendiente' | 'hecho'
  auditoria_id: string | null
  instalacion_id: string | null
  notas: string | null
}

function formatRango(inicio: string, fin: string): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const i = new Date(inicio + 'T12:00:00').toLocaleDateString('es-MX', opts)
  if (inicio === fin) return i
  const f = new Date(fin + 'T12:00:00').toLocaleDateString('es-MX', opts)
  return `${i} – ${f}`
}

function ChipVisita() {
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: 'var(--agro-success-fill)', color: 'var(--agro-success-text)' }}
    >
      Visita
    </span>
  )
}

function ChipAviso() {
  return (
    <span
      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
    >
      Se elimina — descarga tu reporte
    </span>
  )
}

function EventoCard({
  evento,
  onMarcarHecho,
  onAbrirAuditoria,
}: {
  evento: EventoAgenda
  onMarcarHecho: (id: string) => void
  onAbrirAuditoria: (auditoriaId: string) => void
}) {
  const esAviso = evento.tipo === 'aviso_borrado'
  const esHecho = evento.estado === 'hecho'

  return (
    <div
      className="rounded-xl border border-border p-4 flex flex-col gap-2"
      style={{ backgroundColor: 'var(--card)', opacity: esHecho ? 0.55 : 1 }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="mb-1">{esAviso ? <ChipAviso /> : <ChipVisita />}</div>
          <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--foreground)' }}>
            {evento.titulo}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {formatRango(evento.fecha_inicio, evento.fecha_fin)}
          </p>
        </div>
        {!esHecho && (
          <button
            onClick={() => onMarcarHecho(evento.id)}
            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Marcar como hecho"
            style={{ border: '1px solid var(--border)' }}
          >
            <Check size={13} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        )}
      </div>

      {esAviso && evento.auditoria_id && !esHecho && (
        <button
          onClick={() => onAbrirAuditoria(evento.auditoria_id!)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg self-start transition-colors hover:opacity-80"
          style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}
        >
          Abrir y descargar reporte →
        </button>
      )}
    </div>
  )
}

export function MisVisitas() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()
  const [eventos, setEventos] = useState<EventoAgenda[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!profile?.id) return
    cargar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  async function cargar() {
    setCargando(true)
    try {
      const { data, error } = await tbl('aud_agenda')
        .select('*')
        .order('fecha_inicio', { ascending: true })
      if (error) throw error
      setEventos(data ?? [])
    } catch (e) {
      console.error('[MisVisitas]', e)
      toast.error('No se pudo cargar la agenda')
    } finally {
      setCargando(false)
    }
  }

  async function marcarHecho(id: string) {
    try {
      const { error } = await tbl('aud_agenda').update({ estado: 'hecho' }).eq('id', id)
      if (error) throw error
      setEventos(prev => prev.map(e => e.id === id ? { ...e, estado: 'hecho' as const } : e))
    } catch (e) {
      console.error('[MisVisitas] marcarHecho', e)
      toast.error('No se pudo actualizar. Reintenta.')
    }
  }

  const pendientes = eventos.filter(e => e.estado === 'pendiente')
  const hechos = eventos.filter(e => e.estado === 'hecho')

  if (cargando) {
    return (
      <p className="text-sm text-center py-12" style={{ color: 'var(--muted-foreground)' }}>
        Cargando agenda…
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <p
          className="text-[11px] font-semibold uppercase tracking-wide mb-2.5"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Próximos eventos
        </p>
        {pendientes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 flex flex-col items-center gap-2">
            <Calendar size={28} style={{ color: 'var(--muted-foreground)', opacity: 0.35 }} />
            <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
              Sin eventos pendientes.
              <br />Los avisos de borrado aparecen aquí solos.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {pendientes.map(ev => (
              <EventoCard
                key={ev.id}
                evento={ev}
                onMarcarHecho={marcarHecho}
                onAbrirAuditoria={(aid) => navigate(`/auditor/auditoria/${aid}`)}
              />
            ))}
          </div>
        )}
      </section>

      {hechos.length > 0 && (
        <section>
          <p
            className="text-[11px] font-semibold uppercase tracking-wide mb-2.5"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Completados
          </p>
          <div className="flex flex-col gap-2">
            {hechos.map(ev => (
              <EventoCard
                key={ev.id}
                evento={ev}
                onMarcarHecho={marcarHecho}
                onAbrirAuditoria={(aid) => navigate(`/auditor/auditoria/${aid}`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
