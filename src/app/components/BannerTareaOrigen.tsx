import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Props {
  tareaId: string | null
  registroGuardado?: boolean
}

interface TareaBasica {
  titulo: string
  rancho_nombre: string | null
}

export function BannerTareaOrigen({ tareaId, registroGuardado = false }: Props) {
  const navigate = useNavigate()
  const [tarea, setTarea] = useState<TareaBasica | null>(null)

  useEffect(() => {
    if (!tareaId) { setTarea(null); return }
    let cancelado = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(supabase as any)
      .rpc('org_tarea_detalle', { p_tarea_id: tareaId })
      .then(({ data }: { data: unknown }) => {
        if (cancelado) return
        const row = Array.isArray(data) ? (data[0] ?? null) : (data ?? null)
        if (row?.tarea) {
          setTarea({ titulo: row.tarea.titulo, rancho_nombre: row.tarea.rancho_nombre ?? null })
        }
      })
    return () => { cancelado = true }
  }, [tareaId])

  if (!tareaId) return null

  const titulo = tarea?.titulo ?? 'Tarea asignada'
  const rancho = tarea?.rancho_nombre

  if (registroGuardado) {
    return (
      <div
        className="flex items-center justify-between gap-2 px-4 py-2.5"
        style={{ backgroundColor: 'var(--agro-success-fill)', borderBottom: '1px solid var(--border)' }}
      >
        <span className="text-xs font-semibold flex-1 min-w-0" style={{ color: 'var(--agro-success-text)' }}>
          Registro guardado. ¿Reportar la tarea como realizada?
        </span>
        <button
          onClick={() => navigate(`/inocuidad/agenda?tarea=${tareaId}&accion=reportar`)}
          className="text-xs font-semibold flex-shrink-0 px-2.5 py-1 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          Reportar
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex items-center justify-between gap-2 px-4 py-2.5"
      style={{ backgroundColor: 'var(--agro-success-fill)', borderBottom: '1px solid var(--border)' }}
    >
      <span className="text-xs font-semibold truncate flex-1 min-w-0" style={{ color: 'var(--agro-success-text)' }}>
        Tarea: {titulo}{rancho ? ` · ${rancho}` : ''}
      </span>
      <button
        onClick={() => navigate(`/inocuidad/agenda?tarea=${tareaId}`)}
        className="text-xs font-semibold flex items-center gap-1 flex-shrink-0"
        style={{ color: 'var(--agro-success-text)' }}
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver
      </button>
    </div>
  )
}
