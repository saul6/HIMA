import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { Plus, AlertCircle, Loader, RefreshCw, Info } from 'lucide-react'
import { toast } from 'sonner'
import { useAuditorJornada } from '@/hooks/useAuditorJornada'
import { fechaCorta } from '@/lib/formato'
import type { JornadaCandidataFila } from '@/hooks/useAuditorJornada'
import { hoyMX } from '@/lib/fecha'
import { Portal } from '@/app/components/Portal'
import { motion } from 'motion/react'
import { useEntradaPantalla } from './motionAuditor'
import { ModuloHeader } from '@/app/components/ModuloHeader'
import { Boton } from '@/app/components/ui-mady/Boton'
import { EstadoVacio } from '@/app/components/ui-mady/EstadoVacio'
import { Etiqueta } from '@/app/components/ui-mady/Etiqueta'
import { estadoAuditoria } from './estados'
import { FilaRegistro } from '@/app/components/ui-mady/FilaRegistro'

const MODULO_LABELS: Record<number, string> = {
  1: 'M1', 2: 'M2', 3: 'M3', 4: 'M4', 5: 'M5', 6: 'M6', 7: 'M7',
}

function FilaOperacion({
  fila, selected, onToggle,
}: {
  fila: JornadaCandidataFila
  selected: boolean
  onToggle: () => void
}) {
  return (
    <FilaRegistro
      seleccionable
      seleccionado={selected}
      onClick={onToggle}
      titulo={
        <>
          {fila.operacion}
          {fila.operacion_codigo ? <span className="ml-1.5 text-caption font-mono" style={{ color: 'var(--muted-foreground)' }}>({fila.operacion_codigo})</span> : null}
        </>
      }
      lineas={
        <>
          <span className="flex flex-wrap gap-2">
            {fila.producto && (
              <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                {fila.producto}
              </span>
            )}
            {fila.tipo_operacion && (
              <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                · {fila.tipo_operacion}
              </span>
            )}
            {fila.modulos.length > 0 && (
              <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
                · {fila.modulos.map(m => MODULO_LABELS[m] ?? `M${m}`).join(', ')}
              </span>
            )}
            <span className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
              · {fechaCorta(fila.fecha)}
            </span>
          </span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            <Etiqueta tono={estadoAuditoria(fila.estado).tono}>{estadoAuditoria(fila.estado).texto}</Etiqueta>
            {fila.efimera && <Etiqueta>Instalación no vinculada</Etiqueta>}
            {fila.en_jornada_abierta && <Etiqueta tono="sky">Ya en jornada abierta</Etiqueta>}
          </span>
        </>
      }
    />
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

  const ent = useEntradaPantalla(porProductor.length > 0)

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

      <ModuloHeader
        tituloFallback="Auditar por bloque"
        subtitulo="Selecciona las operaciones a incluir en la jornada"
        onBack={() => navigate('/auditor')}
        acciones={cargandoCandidatas ? (
          <span className="flex size-11 items-center justify-center">
            <Loader size={16} className="animate-spin motion-reduce:animate-none" style={{ color: 'var(--muted-foreground)' }} />
          </span>
        ) : (
          <Boton variante="icono" onClick={cargarCandidatas} aria-label="Recargar">
            <RefreshCw size={15} style={{ color: 'var(--muted-foreground)' }} />
          </Boton>
        )}
      />

      <main className="flex-1 flex flex-col">

        {/* Error */}
        {errorCandidatas && (
          <div className="mx-4 mt-4 rounded-xl border border-dashed border-border p-4 flex items-center gap-3">
            <AlertCircle size={16} style={{ color: 'var(--agro-danger-text)' }} />
            <p className="text-sm flex-1" style={{ color: 'var(--muted-foreground)' }}>{errorCandidatas}</p>
            <Boton variante="secundario" onClick={cargarCandidatas}>
              Reintentar
            </Boton>
          </div>
        )}

        {/* Vacío */}
        {!cargandoCandidatas && !errorCandidatas && candidatas.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <EstadoVacio
              icono={Info}
              titulo="Sin auditorías disponibles"
              ayuda="No hay auditorías abiertas a las que tengas acceso. Crea una desde el perfil del productor."
              accion={(
                <Boton variante="secundario" onClick={() => navigate('/auditor')}>
                  Ir al inicio
                </Boton>
              )}
            />
          </div>
        )}

        {/* Lista por productor: un solo fundido al llegar los datos (no una entrada por fila) */}
        {porProductor.length > 0 && (
        <motion.div {...ent(0)}>
        {porProductor.map(([productor, filas]) => (
          <div key={productor}>
            <div
              className="px-4 py-2"
              style={{ backgroundColor: 'var(--muted)' }}
            >
              <p className="text-caption font-semibold" style={{ color: 'var(--muted-foreground)' }}>
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
        </motion.div>
        )}

        {/* Enlace a nuevas auditorías */}
        {!cargandoCandidatas && candidatas.length > 0 && (
          <div className="px-4 py-3 border-t border-border mt-2">
            <p className="text-caption" style={{ color: 'var(--muted-foreground)' }}>
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
            aria-label="Nombre de la jornada (opcional)"
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder={nombreDefault}
            className="w-full text-sm"
            style={{
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--input-background)',
              color: 'var(--foreground)',
              padding: '0.5rem 0.75rem',
            }}
          />
          <Boton onClick={handleCrear} cargando={creando} className="w-full">
            <Plus size={15} />Comenzar con {seleccionados.size} {seleccionados.size === 1 ? 'operación' : 'operaciones'} de {nProductores} {nProductores === 1 ? 'productor' : 'productores'}
          </Boton>
        </div>
        </Portal>
      )}
    </div>
  )
}
