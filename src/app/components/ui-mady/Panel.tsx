import type { ReactNode } from 'react'
import { cn } from '../ui/utils'
import { TituloSeccion } from './TituloSeccion'

interface PanelProps {
  /** Título de la sección (tipo oración, con `TituloSeccion`). */
  titulo?: string
  /** Botones o enlaces a la derecha del título. */
  acciones?: ReactNode
  children: ReactNode
  className?: string
}

/** Tarjeta simple para bloques que no son registros (cuenta, ajustes, resúmenes).
 * Mismo fondo, borde y radio que `TarjetaRegistro`; sin franja ni firmas.
 * Uso: <Panel titulo="Cuenta" acciones={<Boton ...>}>…</Panel> */
export function Panel({ titulo, acciones, children, className }: PanelProps) {
  return (
    <section className={cn('min-w-0 rounded-xl border border-border bg-card p-4', className)}>
      {(titulo || acciones) && (
        <div className="mb-2.5 flex items-center justify-between gap-2">
          {titulo ? (
            <TituloSeccion as="h2" className="mb-0 min-w-0 truncate" title={titulo}>{titulo}</TituloSeccion>
          ) : <span />}
          {acciones && <div className="flex flex-shrink-0 items-center gap-2">{acciones}</div>}
        </div>
      )}
      {children}
    </section>
  )
}
