import { useReducedMotion } from 'motion/react'
import { useContadorAnimado } from '@/hooks/useContadorAnimado'
import { cn } from '../ui/utils'

type VarianteContador = 'normal' | 'seleccionable' | 'alerta'

interface TarjetaContadorProps {
  etiqueta: string
  valor: number | null
  /** Formato del número; por defecto entero. */
  format?: (n: number) => string
  sub?: string
  variante?: VarianteContador
  /** Solo en `seleccionable`: estado activo (aria-pressed). */
  activo?: boolean
  onClick?: () => void
  className?: string
}

const formatoEntero = (n: number) => String(Math.round(n))

/** Tarjeta con número animado y etiqueta. `seleccionable` es un button con
 * aria-pressed y estado activo; `alerta` usa el rojo fuerte (--destructive), p. ej. "Vencidas".
 * Sin sombra. Uso: <TarjetaContador etiqueta="Vencidas" valor={3} variante="alerta" /> */
export function TarjetaContador({
  etiqueta, valor, format = formatoEntero, sub, variante = 'normal', activo = false, onClick, className,
}: TarjetaContadorProps) {
  const reducedMotion = useReducedMotion() ?? false
  const spanRef = useContadorAnimado(valor, format, reducedMotion)
  const alerta = variante === 'alerta'

  const cuerpo = (
    <>
      <span className={cn('text-xs', alerta ? 'text-destructive' : 'text-muted-foreground')}>{etiqueta}</span>
      <span className={cn('text-2xl font-bold tabular-nums', alerta ? 'text-destructive' : 'text-foreground')}>
        <span ref={spanRef}>{valor === null ? '—' : format(valor)}</span>
      </span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </>
  )
  const clase = cn(
    'flex flex-col items-start gap-1 rounded-xl border bg-card p-4 text-left',
    alerta ? 'border-destructive' : 'border-border',
    variante === 'seleccionable' && [
      'outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
      activo ? 'border-primary bg-muted' : 'hover:bg-muted',
    ],
    className,
  )

  if (variante === 'seleccionable') {
    return (
      <button type="button" aria-pressed={activo} onClick={onClick} className={clase}>
        {cuerpo}
      </button>
    )
  }
  return <div className={clase}>{cuerpo}</div>
}
