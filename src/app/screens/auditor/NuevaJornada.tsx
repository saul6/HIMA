import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft, Plus, AlertCircle, Loader, RefreshCw, CheckSquare, Square, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useAuditorJornada } from '@/hooks/useAuditorJornada'
import type { JornadaCandidataFila } from '@/hooks/useAuditorJornada'
import { hoyMX } from '@/lib/fecha'
import { Portal } from '@/app/components/Portal'

const MODULO_LABELS: Record<number, string> = {
  1: 'M1', 2: 'M2', 3: 'M3', 4: 'M4', 5: 'M5', 6: 'M6', 7: 'M7',
}

function formatFecha(f: string) {
  const [y, m, d] = f.split('-')
  return `${parseInt(d, 10)} ${['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][parseInt(m, 10)]} ${y}`
}

function FilaOperacion({
  fila, selected, onToggle,
}: {
  fila: JornadaCandidataFila
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full text-left px-4 py-3 flex items-center gap-3 active:opacity-70 transition-opacity"
      style={{
        backgroundColor: selected ? 'var(--agro-success-fill)' : 'transparent',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {selected
          ? <CheckSquare size={16} style={{ color: 'var(--primary)' }} />
          : <Square size={16} style={{ color: 'var(--muted-foreground)' }} />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>
          {fila.operacion}
          {fila.operacion_codigo ? <span className="ml-1.5 text-[10px] font-mono" style={{ color: 'var(--muted-foreground)' }}>({fila.operacion_codigo})</span> : null}
        </p>
        <div className="flex flex-wrap gap-2 mt-0.5">
          {fila.producto && (
            <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
              {fila.producto}
            </span>
          )}
          {fila.tipo_operacion && (
            <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
              · {fila.tipo_operacion}
            </span>
          )}
          {fila.modulos.length > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
              · {fila.modulos.map(m => MODULO_LABELS[m] ?? `M${m}`).join(', ')}
            </span>
          )}
          <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
            · {formatFecha(fila.fecha)}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          <span
            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{
              backgroundColor: fila.estado === 'en_proceso' ? 'var(--agro-warning-fill)' : 'var(--muted)',
              color: fila.estado === 'en_proceso' ? 'var(--agro-warning-text)' : 'var(--muted-foreground)',
            }}
          >
            {fila.estado === 'en_proceso' ? 'En proceso' : fila.estado}
          </span>
          {fila.efimera && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px]"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
              Instalación no vinculada
            </span>
          )}
          {fila.en_jornada_abierta && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px]"
              style={{ backgroundColor: 'var(--agro-warning-fill)', color: 'var(--agro-warning-text)' }}>
              Ya en jornada abierta
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

export function NuevaJornada() {
  const navigate = useNavigate()
  const { candidatas, cargandoCandidatas, errorCandidatas, cargarCandidatas, crearJornada } = useAuditorJornada()

  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [nombre, setNombre] = useState('')
  const [creando, setCreando] = useState(false)
  const [eventIdRef] = useState(() => ({ current: null as string | null }))

  const hoy = hoyMX()

  useEffect(() => { cargarCandidatas() }, [cargarCandidatas])

  const nombreDefault = `Jornada ${hoy.split('-').reverse().join('/')}`

  const porProductor = useMemo(() => {
    const map = new Map<string, JornadaCandidataFila[]>()
    for (const c of candidatas) {
      if (!map.has(c.productor)) map.set(c.productor, [])
      map.get(c.productor)!.push(c)
    }
    return [...map.entries()]
  }, [candidatas])

  function toggleOperacion(auditoriaId: string) {
    setSeleccionados(prev => {
      const next = new Set(prev)
      if (next.has(auditoriaId)) next.delete(auditoriaId)
      else if (next.size < 12) next.add(auditoriaId)
      else {
        toast.warning('Máximo 12 operaciones por jornada.')
      }
      return next
    })
  }

  const nProductores = new Set(
    candidatas.filter(c => seleccionados.has(c.auditoria_id)).map(c => c.productor)
  ).size

  async function handleCrear() {
    if (seleccionados.size === 0) return
    if (creando) return
    if (!eventIdRef.current) eventIdRef.current = crypto.randomUUID()
    setCreando(true)
    try {
      const jornadaId = await crearJornada(
        nombre.trim() || nombreDefault,
        [...seleccionados],
      )
      navigate(`/auditor/jornada/${jornadaId}`, { replace: true })
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? ''
      if (msg.includes('cerrada') || msg.includes('acceso')) {
        toast.error('Algunas auditorías no están disponibles. Refresca e intenta de nuevo.')
      } else {
        toast.error('No se pudo crear la jornada. Reintenta.')
      }
      console.error('[NuevaJornada] crearJornada', e)
      eventIdRef.current = null  // permitir reintento
    } finally {
      setCreando(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--background)' }}>

      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b border-border flex items-center gap-3 px-4 py-3"
        style={{ backgroundColor: 'var(--card)' }}
      >
        <button
          onClick={() => navigate('/auditor')}
          className="w-8 h-8 rounded-lg flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Volver"
        >
          <ChevronLeft size={18} style={{ color: 'var(--foreground)' }} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold" style={{ color: 'var(--foreground)' }}>
            Auditar por bloque
          </h1>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            Selecciona las operaciones a incluir en la jornada
          </p>
        </div>
        {cargandoCandidatas && <Loader size={16} className="animate-spin flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />}
        {!cargandoCandidatas && (
          <button
            onClick={cargarCandidatas}
            className="w-8 h-8 rounded-lg flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Recargar"
          >
            <RefreshCw size={15} style={{ color: 'var(--muted-foreground)' }} />
          </button>
        )}
      </header>

      <main className="flex-1 flex flex-col">

        {/* Error */}
        {errorCandidatas && (
          <div className="mx-4 mt-4 rounded-xl border border-dashed border-border p-4 flex items-center gap-3">
            <AlertCircle size={16} style={{ color: 'var(--agro-danger-text)' }} />
            <p className="text-sm flex-1" style={{ color: 'var(--muted-foreground)' }}>{errorCandidatas}</p>
            <button onClick={cargarCandidatas} className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
              Reintentar
            </button>
          </div>
        )}

        {/* Vacío */}
        {!cargandoCandidatas && !errorCandidatas && candidatas.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-3 py-12">
            <Info size={28} style={{ color: 'var(--muted-foreground)', opacity: 0.4 }} />
            <p className="text-sm font-medium text-center" style={{ color: 'var(--foreground)' }}>
              Sin auditorías disponibles
            </p>
            <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
              No hay auditorías abiertas a las que tengas acceso. Crea una desde el perfil del productor.
            </p>
            <button
              onClick={() => navigate('/auditor')}
              className="text-sm font-semibold px-4 py-2 rounded-lg mt-1"
              style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
            >
              Ir al inicio
            </button>
          </div>
        )}

        {/* Lista por productor */}
        {porProductor.map(([productor, filas]) => (
          <div key={productor}>
            <div
              className="px-4 py-2"
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--muted-foreground)' }}>
                {productor}
              </p>
            </div>
            {filas.map(fila => (
              <FilaOperacion
                key={fila.auditoria_id}
                fila={fila}
                selected={seleccionados.has(fila.auditoria_id)}
                onToggle={() => toggleOperacion(fila.auditoria_id)}
              />
            ))}
          </div>
        ))}

        {/* Enlace a nuevas auditorías */}
        {!cargandoCandidatas && candidatas.length > 0 && (
          <div className="px-4 py-3 border-t border-border mt-2">
            <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
              ¿Necesitas crear una auditoría?{' '}
              <button
                onClick={() => navigate('/auditor')}
                className="font-semibold underline-offset-2 underline"
                style={{ color: 'var(--primary)' }}
              >
                Ir al inicio del auditor
              </button>
            </p>
          </div>
        )}

        {/* Spacer para el footer */}
        <div className="h-36" />
      </main>

      {/* Footer fijo — resumen + botón */}
      {seleccionados.size > 0 && (
        <Portal>
        <div
          className="fixed bottom-0 left-0 right-0 z-20 border-t border-border px-4 py-4 flex flex-col gap-3"
          style={{ backgroundColor: 'var(--card)' }}
        >
          {/* Nombre (opcional) */}
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder={nombreDefault}
            className="w-full text-sm outline-none"
            style={{
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--input-background)',
              color: 'var(--foreground)',
              padding: '0.5rem 0.75rem',
            }}
          />
          <button
            onClick={handleCrear}
            disabled={creando}
            className="w-full h-12 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ backgroundColor: 'var(--primary)', color: '#fff' }}
          >
            {creando
              ? <><Loader size={15} className="animate-spin" />Creando…</>
              : <><Plus size={15} />Comenzar con {seleccionados.size} {seleccionados.size === 1 ? 'operación' : 'operaciones'} de {nProductores} {nProductores === 1 ? 'productor' : 'productores'}</>
            }
          </button>
        </div>
        </Portal>
      )}
    </div>
  )
}
