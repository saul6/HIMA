import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { Calendar, Check } from 'lucide-react'
import { toast } from 'sonner'
import { motion, useReducedMotion } from 'motion/react'
import { useAuthContext } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { ListaSkeleton } from '@/app/components/ListaSkeleton'
import { useMostrarCarga } from '@/hooks/useMostrarCarga'
import { TituloSeccion } from '@/app/components/ui-mady/TituloSeccion'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { Boton } from '@/app/components/ui-mady/Boton'
import { DUR, EASE_OUT } from '@/lib/motion'
import { formatRango } from '@/lib/formato'

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
}

type Seccion = 'pendientes' | 'hechos'
const PAGINA = 20
const COLUMNAS = 'id,tipo,titulo,fecha_inicio,fecha_fin,estado,auditoria_id'

// Trae PAGINA + 1 filas para saber si hay más sin una consulta extra.
// Pendientes: más próximas primero. Completados: más recientes primero. `id` desempata
// para que dos eventos con la misma fecha no cambien de lugar entre páginas.
function consultarSeccion(seccion: Seccion, desde: number) {
  const base = tbl('aud_agenda').select(COLUMNAS)
  const filtrada = seccion === 'pendientes' ? base.eq('estado', 'pendiente') : base.neq('estado', 'pendiente')
  return filtrada
    .order('fecha_inicio', { ascending: seccion === 'pendientes' })
    .order('id', { ascending: true })
    .range(desde, desde + PAGINA)
}

function sinRepetidos(previos: EventoAgenda[], nuevos: EventoAgenda[]) {
  const vistos = new Set(previos.map(e => e.id))
  return [...previos, ...nuevos.filter(e => !vistos.has(e.id))]
}

function ChipVisita() {
  return (
    <Etiqueta tono="menta">Visita</Etiqueta>
  )
}

function ChipAviso() {
  return (
    <Etiqueta tono="sky">Se elimina — descarga tu reporte</Etiqueta>
  )
}

function EventoCard({
  evento,
  index,
  reducedMotion,
  onMarcarHecho,
  onAbrirAuditoria,
}: {
  evento: EventoAgenda
  index: number
  reducedMotion: boolean | null
  onMarcarHecho: (id: string) => void
  onAbrirAuditoria: (auditoriaId: string) => void
}) {
  const esAviso = evento.tipo === 'aviso_borrado'
  const esHecho = evento.estado === 'hecho'

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{
        opacity: 1, y: 0,
        transition: { duration: DUR.base, ease: EASE_OUT, delay: Math.min(index, 7) * 0.03 },
      }}
      className="rounded-xl border border-border p-4 flex flex-col gap-2 transition-colors hover:bg-muted"
      style={{ backgroundColor: 'var(--card)', transitionDuration: 'var(--motion-fast)' }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="mb-1">{esAviso ? <ChipAviso /> : <ChipVisita />}</div>
          <p
            className="text-sm font-semibold leading-snug"
            style={{ color: esHecho ? 'var(--muted-foreground)' : 'var(--foreground)' }}
          >
            {evento.titulo}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            {formatRango(evento.fecha_inicio, evento.fecha_fin)}
          </p>
        </div>
        {!esHecho && (
          <button
            onClick={() => onMarcarHecho(evento.id)}
            className="relative before:absolute before:-inset-2 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Marcar como hecho"
            style={{ border: '1px solid var(--border)' }}
          >
            <Check aria-hidden="true" size={13} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        )}
      </div>

      {esAviso && evento.auditoria_id && !esHecho && (
        <button
          onClick={() => onAbrirAuditoria(evento.auditoria_id!)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg self-start transition-colors hover:opacity-80"
          style={{ backgroundColor: 'var(--agro-info-fill)', color: 'var(--agro-info-text)' }}
        >
          Abrir y descargar reporte →
        </button>
      )}
    </motion.div>
  )
}

export function MisVisitas() {
  const { profile } = useAuthContext()
  const navigate = useNavigate()
  const [pendientes, setPendientes] = useState<EventoAgenda[]>([])
  const [hechos, setHechos] = useState<EventoAgenda[]>([])
  const [hayMas, setHayMas] = useState<Record<Seccion, boolean>>({ pendientes: false, hechos: false })
  const [cargandoMas, setCargandoMas] = useState<Record<Seccion, boolean>>({ pendientes: false, hechos: false })
  // Filas ya leídas del servidor por sección (el siguiente range() empieza ahí).
  const desdeRef = useRef<Record<Seccion, number>>({ pendientes: 0, hechos: 0 })
  const [cargando, setCargando] = useState(true)
  const reducedMotion = useReducedMotion()
  const mostrarSkeleton = useMostrarCarga(cargando, pendientes.length + hechos.length > 0)

  useEffect(() => {
    if (!profile?.id) return
    cargar()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id])

  async function cargar() {
    setCargando(true)
    try {
      const [rp, rh] = await Promise.all([consultarSeccion('pendientes', 0), consultarSeccion('hechos', 0)])
      if (rp.error) throw rp.error
      if (rh.error) throw rh.error
      const dp = (rp.data ?? []) as EventoAgenda[]
      const dh = (rh.data ?? []) as EventoAgenda[]
      desdeRef.current = { pendientes: Math.min(dp.length, PAGINA), hechos: Math.min(dh.length, PAGINA) }
      setPendientes(dp.slice(0, PAGINA))
      setHechos(dh.slice(0, PAGINA))
      setHayMas({ pendientes: dp.length > PAGINA, hechos: dh.length > PAGINA })
    } catch (e) {
      console.error('[MisVisitas]', e)
      toast.error('No se pudo cargar la agenda')
    } finally {
      setCargando(false)
    }
  }

  async function verMas(seccion: Seccion) {
    if (cargandoMas[seccion]) return
    setCargandoMas(prev => ({ ...prev, [seccion]: true }))
    try {
      const { data, error } = await consultarSeccion(seccion, desdeRef.current[seccion])
      if (error) throw error
      const filas = (data ?? []) as EventoAgenda[]
      desdeRef.current[seccion] += Math.min(filas.length, PAGINA)
      const agregar = (prev: EventoAgenda[]) => sinRepetidos(prev, filas.slice(0, PAGINA))
      if (seccion === 'pendientes') setPendientes(agregar)
      else setHechos(agregar)
      setHayMas(prev => ({ ...prev, [seccion]: filas.length > PAGINA }))
    } catch (e) {
      console.error('[MisVisitas] verMas', e)
      toast.error('No se pudo cargar la agenda')
    } finally {
      setCargandoMas(prev => ({ ...prev, [seccion]: false }))
    }
  }

  async function marcarHecho(id: string) {
    try {
      const { error } = await tbl('aud_agenda').update({ estado: 'hecho' }).eq('id', id)
      if (error) throw error
      const ev = pendientes.find(e => e.id === id)
      if (!ev) return
      // En el servidor la sección de pendientes ahora tiene una fila menos.
      desdeRef.current.pendientes = Math.max(0, desdeRef.current.pendientes - 1)
      setPendientes(prev => prev.filter(e => e.id !== id))
      setHechos(prev => {
        const nuevo = { ...ev, estado: 'hecho' as const }
        // Completados va de más reciente a más antiguo.
        const i = prev.findIndex(e => e.fecha_inicio < nuevo.fecha_inicio)
        return i === -1 ? [...prev, nuevo] : [...prev.slice(0, i), nuevo, ...prev.slice(i)]
      })
    } catch (e) {
      console.error('[MisVisitas] marcarHecho', e)
      toast.error('No se pudo actualizar. Reintenta.')
    }
  }

  function botonVerMas(seccion: Seccion) {
    if (!hayMas[seccion]) return null
    return (
      <div className="mt-3 flex justify-center">
        <Boton variante="secundario" onClick={() => verMas(seccion)} cargando={cargandoMas[seccion]}>
          Ver más
        </Boton>
      </div>
    )
  }

  if (cargando) {
    return mostrarSkeleton ? <ListaSkeleton rows={4} /> : null
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <TituloSeccion as="p">Próximos eventos</TituloSeccion>
        {pendientes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-6 flex flex-col items-center gap-2">
            <Calendar aria-hidden="true" size={28} style={{ color: 'var(--muted-foreground)', opacity: 0.35 }} />
            <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
              Sin eventos pendientes.
              <br />Los avisos de borrado aparecen aquí solos.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 min-[1480px]:grid min-[1480px]:grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]">
            {pendientes.map((ev, index) => (
              <EventoCard
                key={ev.id}
                index={index}
                reducedMotion={reducedMotion}
                evento={ev}
                onMarcarHecho={marcarHecho}
                onAbrirAuditoria={(aid) => navigate(`/auditor/auditoria/${aid}`)}
              />
            ))}
          </div>
        )}
        {botonVerMas('pendientes')}
      </section>

      {hechos.length > 0 && (
        <section>
          <TituloSeccion as="p">Completados</TituloSeccion>
          <div className="flex flex-col gap-2 min-[1480px]:grid min-[1480px]:grid-cols-[repeat(auto-fill,minmax(20rem,1fr))]">
            {hechos.map((ev, index) => (
              <EventoCard
                key={ev.id}
                index={index}
                reducedMotion={reducedMotion}
                evento={ev}
                onMarcarHecho={marcarHecho}
                onAbrirAuditoria={(aid) => navigate(`/auditor/auditoria/${aid}`)}
              />
            ))}
          </div>
          {botonVerMas('hechos')}
        </section>
      )}
    </div>
  )
}
