import { useEffect, useId, useSyncExternalStore } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Boton } from './Boton'
import { useCargaLenta } from '@/hooks/useCargaLenta'
import { DUR, EASE_OUT } from '@/lib/motion'

// Registro común: varios esqueletos pueden estar cargando a la vez, pero solo el
// aviso que se registró primero se pinta. Si ese se desmonta, toma el turno el siguiente.
let ids: string[] = []
const oyentes = new Set<() => void>()

function emitir() {
  oyentes.forEach(fn => fn())
}
function suscribir(fn: () => void) {
  oyentes.add(fn)
  return () => { oyentes.delete(fn) }
}
function primero() {
  return ids[0] ?? null
}

interface AvisoCargaLentaProps {
  /** Si la carga sigue en curso. Los esqueletos lo montan solo mientras cargan, así que por defecto es true. */
  activo?: boolean
  /** Milisegundos antes de mostrar el aviso. */
  ms?: number
  /** Función de recarga/refetch que la pantalla YA tiene; agrega el botón "Reintentar". */
  onReintentar?: () => void
  /** false cuando el esqueleto vive sobre un formulario a medio llenar: recargar la página borraría lo escrito. */
  permitirRecargar?: boolean
}

/** Red de seguridad para cargas que no terminan: aparece tras `ms` y nunca antes.
 * Un solo aviso a la vez en toda la pantalla. */
export function AvisoCargaLenta({ activo = true, ms = 12000, onReintentar, permitirRecargar = true }: AvisoCargaLentaProps) {
  const id = useId()
  const lenta = useCargaLenta(activo, ms)
  const reducedMotion = useReducedMotion()
  const dueno = useSyncExternalStore(suscribir, primero, primero)

  useEffect(() => {
    if (!lenta) return
    ids = [...ids, id]
    emitir()
    return () => {
      ids = ids.filter(x => x !== id)
      emitir()
    }
  }, [lenta, id])

  if (!lenta || dueno !== id) return null
  if (!permitirRecargar && !onReintentar) {
    return <Mensaje reducedMotion={!!reducedMotion} soloTexto />
  }

  return (
    <Mensaje reducedMotion={!!reducedMotion}>
      {onReintentar && <Boton onClick={onReintentar}>Reintentar</Boton>}
      {permitirRecargar && (
        <Boton variante="secundario" onClick={() => window.location.reload()}>Volver a cargar</Boton>
      )}
    </Mensaje>
  )
}

function Mensaje({ reducedMotion, soloTexto = false, children }: { reducedMotion: boolean; soloTexto?: boolean; children?: React.ReactNode }) {
  return (
    <motion.div
      role="status"
      className="flex flex-col items-center gap-3 px-4 py-6 text-center"
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: DUR.base, ease: EASE_OUT }}
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Está tardando más de lo normal.</p>
        {!soloTexto && <p className="text-xs text-muted-foreground">Revisa tu conexión o vuelve a cargar la página.</p>}
      </div>
      {children && <div className="flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </motion.div>
  )
}
