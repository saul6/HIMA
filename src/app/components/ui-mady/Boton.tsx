import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../ui/utils'

type Variante = 'primario' | 'secundario' | 'icono'
type Tamano = 'md' | 'sm'

interface BotonBase extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamano?: Tamano
  /** Spinner 16px, ancho fijo, aria-busy y deshabilitado. */
  cargando?: boolean
}

// En `icono` el aria-label es obligatorio (el botón no trae texto).
type BotonProps =
  | (BotonBase & { variante: 'icono'; 'aria-label': string })
  | (BotonBase & { variante?: 'primario' | 'secundario' })

const BASE =
  'relative inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-semibold ' +
  'transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ' +
  'disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-primary text-primary-foreground transition-colors duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:bg-primary/90',
  secundario: 'border border-border-control bg-transparent text-foreground hover:bg-muted',
  icono: 'border border-transparent bg-transparent text-foreground hover:bg-muted',
}

/** Botón único de la app. Primario (--primary), secundario (borde --border-control)
 * o icono (44×44, aria-label obligatorio). No fuerza `type`: si no lo pasas, no se pone.
 * Sin sombra. Uso: <Boton variante="primario" onClick={...}>Guardar</Boton> */
export const Boton = React.forwardRef<HTMLButtonElement, BotonProps>(function Boton(
  { variante = 'primario', tamano = 'md', cargando = false, className, disabled, children, ...props },
  ref,
) {
  const medida =
    variante === 'icono'
      ? 'size-11 rounded-[var(--radius)]'
      : tamano === 'sm'
        ? 'h-9 px-3 rounded-[var(--radius)]'
        : 'h-11 px-4 rounded-[var(--radius)]'
  return (
    <button
      ref={ref}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={cn(BASE, VARIANTES[variante], medida, className)}
      {...props}
    >
      {cargando && (
        <Loader2 className="absolute size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      )}
      <span className={cn('inline-flex items-center justify-center gap-2', cargando && 'invisible')}>
        {children}
      </span>
    </button>
  )
})
